from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlmodel import Session

from app.auth import get_current_user_id_ws
from app.config import ICE_SERVERS
from app.db import engine
from app.models import Call, Message, User
from app.ws.connection_manager import manager

router = APIRouter()

# Tracks who is currently ringing/in-call with whom, and the Call row id,
# so we know how to log the outcome and reject a second invite while busy.
# Shape: {user_id: {"peer": other_user_id, "call_id": int, "state": "ringing"|"active"}}
active_sessions: dict[str, dict] = {}


def _both_free(a: str, b: str) -> bool:
    return a not in active_sessions and b not in active_sessions


def _clear(*user_ids: str) -> None:
    for uid in user_ids:
        active_sessions.pop(uid, None)


async def _close_call(caller: str, callee: str, call_id: int | None, status: str) -> None:
    _clear(caller, callee)
    if call_id is None:
        return
    with Session(engine) as session:
        call = session.get(Call, call_id)
        if call:
            call.status = status
            call.ended_at = datetime.utcnow()
            session.add(call)
            session.commit()


@router.websocket("/ws")
async def signaling_endpoint(websocket: WebSocket, token: str):
    try:
        user_id = get_current_user_id_ws(token)
    except Exception:
        await websocket.close(code=4401)
        return

    with Session(engine) as session:
        if not session.get(User, user_id):
            await websocket.close(code=4401)
            return

    await manager.connect(user_id, websocket)
    await manager.send_json(user_id, {"type": "connected", "ice_servers": ICE_SERVERS})

    try:
        while True:
            msg = await websocket.receive_json()
            msg_type = msg.get("type")
            to = msg.get("to")
            payload = msg.get("payload", {})

            # ---------------- Call setup ----------------
            if msg_type == "call:invite":
                call_type = payload.get("callType", "audio")
                if to == user_id:
                    await manager.send_json(user_id, {"type": "call:error", "payload": {"reason": "cannot_call_self"}})
                    continue
                with Session(engine) as session:
                    callee_exists = session.get(User, to) is not None
                if not callee_exists:
                    await manager.send_json(user_id, {"type": "call:error", "payload": {"reason": "user_not_found", "to": to}})
                    continue
                if not manager.is_online(to):
                    with Session(engine) as session:
                        call = Call(caller_id=user_id, callee_id=to, call_type=call_type, status="missed")
                        session.add(call)
                        session.commit()
                    await manager.send_json(user_id, {"type": "call:error", "payload": {"reason": "user_offline", "to": to}})
                    continue
                if not _both_free(user_id, to):
                    await manager.send_json(user_id, {"type": "call:error", "payload": {"reason": "busy", "to": to}})
                    continue

                with Session(engine) as session:
                    call = Call(caller_id=user_id, callee_id=to, call_type=call_type, status="missed")
                    session.add(call)
                    session.commit()
                    session.refresh(call)
                    call_id = call.id

                active_sessions[user_id] = {"peer": to, "call_id": call_id, "state": "ringing"}
                active_sessions[to] = {"peer": user_id, "call_id": call_id, "state": "ringing"}

                delivered = await manager.send_json(to, {
                    "type": "call:invite",
                    "from": user_id,
                    "payload": {"callType": call_type, "callId": call_id},
                })
                if delivered:
                    await manager.send_json(user_id, {"type": "call:ringing", "payload": {"callId": call_id}})
                else:
                    await _close_call(user_id, to, call_id, "missed")
                    await manager.send_json(user_id, {"type": "call:error", "payload": {"reason": "user_offline", "to": to}})

            elif msg_type == "call:accept":
                sess = active_sessions.get(user_id)
                if not sess or sess["peer"] != to:
                    continue
                sess["state"] = "active"
                active_sessions[to]["state"] = "active"
                await manager.send_json(to, {"type": "call:accept", "from": user_id, "payload": payload})

            elif msg_type == "call:reject":
                sess = active_sessions.get(user_id)
                call_id = sess["call_id"] if sess else None
                await manager.send_json(to, {"type": "call:reject", "from": user_id})
                await _close_call(user_id, to, call_id, "rejected")

            elif msg_type == "call:cancel":
                sess = active_sessions.get(user_id)
                call_id = sess["call_id"] if sess else None
                await manager.send_json(to, {"type": "call:cancel", "from": user_id})
                await _close_call(user_id, to, call_id, "cancelled")

            elif msg_type == "call:hangup":
                sess = active_sessions.get(user_id)
                call_id = sess["call_id"] if sess else None
                was_active = sess and sess.get("state") == "active"
                await manager.send_json(to, {"type": "call:hangup", "from": user_id})
                await _close_call(user_id, to, call_id, "completed" if was_active else "cancelled")

            # ---------------- WebRTC relay (server never inspects media) ----------------
            elif msg_type in ("webrtc:offer", "webrtc:answer", "webrtc:ice"):
                await manager.send_json(to, {"type": msg_type, "from": user_id, "payload": payload})

            # ---------------- Chat ----------------
            elif msg_type == "chat:message":
                body = (payload.get("body") or "").strip()
                if not body:
                    continue
                with Session(engine) as session:
                    message = Message(sender_id=user_id, receiver_id=to, body=body)
                    session.add(message)
                    session.commit()
                    session.refresh(message)
                    msg_id = message.id
                    sent_at = message.sent_at.isoformat()

                delivered = await manager.send_json(to, {
                    "type": "chat:message",
                    "from": user_id,
                    "payload": {"id": msg_id, "body": body, "sentAt": sent_at},
                })

                if delivered:
                    with Session(engine) as session:
                        db_msg = session.get(Message, msg_id)
                        if db_msg:
                            db_msg.delivered = True
                            session.add(db_msg)
                            session.commit()

                # echo back to sender with the canonical id so their UI can reconcile
                await manager.send_json(user_id, {
                    "type": "chat:sent",
                    "payload": {"id": msg_id, "to": to, "body": body, "sentAt": sent_at},
                })

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id, websocket)
        sess = active_sessions.get(user_id)
        if sess:
            peer = sess["peer"]
            call_id = sess["call_id"]
            await manager.send_json(peer, {"type": "call:hangup", "from": user_id, "payload": {"reason": "disconnected"}})
            await _close_call(user_id, peer, call_id, "cancelled")
