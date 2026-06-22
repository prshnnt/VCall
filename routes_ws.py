"""
WebSocket signaling endpoint.

ws://host/ws/{room_id}/{peer_id}

Message types (client → server):
  offer          { type, to, payload: { sdp } }
  answer         { type, to, payload: { sdp } }
  ice-candidate  { type, to, payload: { candidate } }
  ping           { type }               → server replies pong
  leave          { type }               → graceful disconnect

Message types (server → client):
  peer-joined    { type, peer_id, display_name }
  peer-left      { type, peer_id }
  offer          { type, from, payload }
  answer         { type, from, payload }
  ice-candidate  { type, from, payload }
  room-state     { type, peers: [...] }   (sent on connect)
  error          { type, message }
  pong           { type }
"""

import json
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from redis_client import (
    get_room_info, get_room_peers, add_peer_to_room,
    remove_peer_from_room, flush_signals, peer_room,
)
from ws_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter()

PING_INTERVAL = 25          # seconds between server-side keep-alive pings
SIGNAL_POLL   = 0.2         # seconds between Redis signal drain cycles


@router.websocket("/ws/{room_id}/{peer_id}")
async def websocket_endpoint(ws: WebSocket, room_id: str, peer_id: str):
    await ws.accept()

    # ── Validate room + peer ──────────────────────────────────────────────────
    info = await get_room_info(room_id)
    if not info:
        await ws.send_json({"type": "error", "message": "Room not found"})
        await ws.close(code=4004)
        return

    room_peer = await peer_room(peer_id)
    if room_peer != room_id:
        await ws.send_json({"type": "error", "message": "Peer not in room"})
        await ws.close(code=4003)
        return

    # ── Register connection ───────────────────────────────────────────────────
    manager.connect(peer_id, room_id, ws)

    # ── Send current room state to the newly connected peer ───────────────────
    peers = await get_room_peers(room_id)
    await ws.send_json({
        "type": "room-state",
        "room_id": room_id,
        "mode": info.get("mode", "room"),
        "peers": [
            {"peer_id": p["peer_id"], "display_name": p.get("display_name", "?")}
            for p in peers
            if p["peer_id"] != peer_id
        ],
    })

    # ── Notify other peers ────────────────────────────────────────────────────
    peer_info = next((p for p in peers if p["peer_id"] == peer_id), {})
    await manager.broadcast_room(room_id, {
        "type": "peer-joined",
        "peer_id": peer_id,
        "display_name": peer_info.get("display_name", "?"),
    }, exclude_peer=peer_id)

    # ── Drain any queued signals (e.g. from a reconnect) ─────────────────────
    queued = await flush_signals(peer_id)
    for msg in queued:
        try:
            await ws.send_json(msg)
        except Exception:
            break

    # ── Background task: poll Redis for cross-worker signals ──────────────────
    stop_event = asyncio.Event()

    async def redis_drain_loop():
        while not stop_event.is_set():
            try:
                msgs = await flush_signals(peer_id)
                for msg in msgs:
                    await ws.send_json(msg)
            except Exception:
                break
            await asyncio.sleep(SIGNAL_POLL)

    drain_task = asyncio.create_task(redis_drain_loop())

    # ── Main receive loop ─────────────────────────────────────────────────────
    try:
        while True:
            try:
                raw = await asyncio.wait_for(ws.receive_text(), timeout=PING_INTERVAL)
            except asyncio.TimeoutError:
                # Send keep-alive ping
                await ws.send_json({"type": "ping"})
                continue

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = msg.get("type", "")

            if msg_type == "ping":
                await ws.send_json({"type": "pong"})

            elif msg_type == "leave":
                break

            elif msg_type in ("offer", "answer", "ice-candidate"):
                target = msg.get("to")
                if not target:
                    await ws.send_json({"type": "error", "message": "Missing 'to' field"})
                    continue
                await manager.relay_signal(
                    sender_peer_id=peer_id,
                    target_peer_id=target,
                    payload={
                        "type": msg_type,
                        "payload": msg.get("payload"),
                    },
                )

            else:
                await ws.send_json({"type": "error", "message": f"Unknown type: {msg_type}"})

    except WebSocketDisconnect:
        logger.info("WS disconnected peer=%s room=%s", peer_id, room_id)
    except Exception as exc:
        logger.error("WS error peer=%s: %s", peer_id, exc)
    finally:
        stop_event.set()
        drain_task.cancel()
        manager.disconnect(peer_id)
        await remove_peer_from_room(room_id, peer_id)
        await manager.broadcast_room(room_id, {
            "type": "peer-left",
            "peer_id": peer_id,
        })
