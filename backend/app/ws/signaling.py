import asyncio
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlmodel import Session

from app.auth import get_current_user_id_ws
from app.config import ICE_SERVERS
from app.db import engine
from app.models import Call, Message, User
from app.push import send_push_to_user_async
from app.ws.connection_manager import manager

router = APIRouter()

# Tracks who is currently ringing/in-call with whom, and the Call row id,
# so we know how to log the outcome and reject a second invite while busy.
# Shape: {user_id: {"peer": ..., "call_id": int, "state": "ringing"|"active",
#                    "role": "caller"|"callee", "call_type": "audio"|"video"}}
active_sessions: dict[str, dict] = {}

# A grace period before we tell the caller "no answer" if the callee's
# WebSocket drops while ringing -- e.g. their phone locked/backgrounded
# and a push notification is what's supposed to wake it back up. If they
# reconnect within this window we resend the pending invite instead of
# losing the call.
RINGING_RECONNECT_GRACE_SECONDS = 15
pending_disconnect_tasks: dict[str, asyncio.Task] = {}


def _both_free(a: str, b: str) -> bool:
    return a not in active_sessions and b not in active_sessions


def _clear(*user_ids: str) -> None:
    for uid in user_ids:
        active_sessions.pop(uid, None)


async def _grace_period_cancel(disconnected_user: str, peer: str, call_id: int | None) -> None:
    try:
        await asyncio.sleep(RINGING_RECONNECT_GRACE_SECONDS)
    except asyncio.CancelledError:
        return  # they reconnected in time; connect handler takes it from here
    if not manager.is_online(disconnected_user):
        await manager.send_json(peer, {"type": "call:cancel", "from": disconnected_user, "payload": {"reason": "no_answer"}})
        await _close_call(disconnected_user, peer, call_id, "missed")
    pending_disconnect_tasks.pop(disconnected_user, None)


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

    # If they reconnected while a call was still ringing for them (e.g. a
    # push notification just woke the app back up), cancel the pending
    # "no answer" timeout and resend the invite so they still see it.
    pending_task = pending_disconnect_tasks.pop(user_id, None)
    if pending_task:
        pending_task.cancel()
    sess = active_sessions.get(user_id)
    if sess and sess.get("state") == "ringing" and sess.get("role") == "callee":
        await manager.send_json(user_id, {
            "type": "call:invite",
            "from": sess["peer"],
            "payload": {"callType": sess.get("call_type", "audio"), "callId": sess["call_id"]},
        })

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
                if not _both_free(user_id, to):
                    await manager.send_json(user_id, {"type": "call:error", "payload": {"reason": "busy", "to": to}})
                    continue

                with Session(engine) as session:
                    call = Call(caller_id=user_id, callee_id=to, call_type=call_type, status="missed")
                    session.add(call)
                    session.commit()
                    session.refresh(call)
                    call_id = call.id

                if not manager.is_online(to):
                    # Still worth a push -- they may have the app installed
                    # but fully closed; a tap on the notification opens it.
                    with Session(engine) as session:
                        await send_push_to_user_async(session, to, {
                            "title": f"Missed {call_type} call",
                            "body": f"{user_id} tried to call you",
                            "data": {"kind": "call", "from": user_id, "callType": call_type, "callId": call_id, "url": "/"},
                        })
                    await manager.send_json(user_id, {"type": "call:error", "payload": {"reason": "user_offline", "to": to}})
                    continue

                active_sessions[user_id] = {"peer": to, "call_id": call_id, "state": "ringing", "role": "caller", "call_type": call_type}
                active_sessions[to] = {"peer": user_id, "call_id": call_id, "state": "ringing", "role": "callee", "call_type": call_type}

                # Push fires alongside the live WS invite too -- useful if
                # their tab/app is merely backgrounded rather than closed.
                with Session(engine) as session:
                    await send_push_to_user_async(session, to, {
                        "title": f"Incoming {call_type} call",
                        "body": f"{user_id} is calling you",
                        "data": {"kind": "call", "from": user_id, "callType": call_type, "callId": call_id, "url": "/"},
                    })

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

                # Push regardless of live delivery: even when `delivered` is
                # True the recipient's tab may just be backgrounded (mobile
                # browser, installed PWA) rather than actively focused, and
                # a push is the only thing that will surface a notification
                # in that case. Truncate the body so we're not echoing a
                # long message into a notification tray.
                with Session(engine) as session:
                    preview = body if len(body) <= 120 else body[:117] + "..."
                    await send_push_to_user_async(session, to, {
                        "title": f"Message from {user_id}",
                        "body": preview,
                        "tag": f"chat-{user_id}",
                        "data": {"kind": "message", "peer": user_id, "url": f"/chats?peer={user_id}"},
                    })

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
            if sess.get("state") == "ringing" and sess.get("role") == "callee":
                # Don't kill the call the instant their socket drops while
                # it's merely ringing -- their tab may just be backgrounded
                # or the OS suspended it, and the push notification we
                # already sent is what's meant to bring them back within
                # the grace window. If they reconnect in time, the invite
                # is resent automatically above.
                pending_disconnect_tasks[user_id] = asyncio.create_task(
                    _grace_period_cancel(user_id, peer, call_id)
                )
            else:
                await manager.send_json(peer, {"type": "call:hangup", "from": user_id, "payload": {"reason": "disconnected"}})
                await _close_call(user_id, peer, call_id, "completed" if sess.get("state") == "active" else "cancelled")
