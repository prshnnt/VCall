"""
WebSocket connection manager.

Responsibilities:
  • Track active WebSocket connections keyed by peer_id (in-process dict).
  • Deliver signaling messages directly via WebSocket when the peer is local.
  • Push to Redis queue when the peer is remote / not connected here (future
    horizontal scaling — for single-process deployments this is a no-op path).
  • Broadcast room events (peer-joined, peer-left) to all peers in a room.
"""

import asyncio
import json
import logging
from starlette.websockets import WebSocket, WebSocketDisconnect, WebSocketState

from redis_client import push_signal, get_room_peers, peer_room

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # peer_id → WebSocket
        self._connections: dict[str, WebSocket] = {}
        # peer_id → room_id  (local cache, source of truth is Redis)
        self._peer_rooms: dict[str, str] = {}

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def connect(self, peer_id: str, room_id: str, ws: WebSocket) -> None:
        self._connections[peer_id] = ws
        self._peer_rooms[peer_id] = room_id
        logger.info("WS connected  peer=%s room=%s", peer_id, room_id)

    def disconnect(self, peer_id: str) -> None:
        self._connections.pop(peer_id, None)
        self._peer_rooms.pop(peer_id, None)
        logger.info("WS disconnected peer=%s", peer_id)

    def is_connected(self, peer_id: str) -> bool:
        return peer_id in self._connections

    # ── Send helpers ──────────────────────────────────────────────────────────

    async def send(self, peer_id: str, message: dict) -> bool:
        """
        Send message to a specific peer.
        Returns True on success, False if peer not locally connected
        (caller should fall back to Redis queue).
        """
        ws = self._connections.get(peer_id)
        if ws and ws.client_state == WebSocketState.CONNECTED:
            try:
                await ws.send_json(message)
                return True
            except Exception as exc:
                logger.warning("send failed peer=%s exc=%s", peer_id, exc)
                self.disconnect(peer_id)
        return False

    async def send_or_queue(self, target_peer_id: str, message: dict) -> None:
        """Try local WS first, fall back to Redis queue."""
        delivered = await self.send(target_peer_id, message)
        if not delivered:
            await push_signal(target_peer_id, message)

    # ── Room broadcast ────────────────────────────────────────────────────────

    async def broadcast_room(
        self,
        room_id: str,
        message: dict,
        exclude_peer: str | None = None,
    ) -> None:
        """Send message to every peer in the room (local + queued for remote)."""
        peers = await get_room_peers(room_id)
        tasks = []
        for peer in peers:
            pid = peer["peer_id"]
            if pid == exclude_peer:
                continue
            tasks.append(self.send_or_queue(pid, message))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    # ── Signal relay ──────────────────────────────────────────────────────────

    async def relay_signal(
        self,
        sender_peer_id: str,
        target_peer_id: str,
        payload: dict,
    ) -> None:
        """
        Relay a WebRTC signaling message (offer/answer/ice-candidate)
        from sender → target.
        """
        message = {
            "type": payload["type"],  # "offer" | "answer" | "ice-candidate"
            "from": sender_peer_id,
            "payload": payload.get("payload"),
        }
        await self.send_or_queue(target_peer_id, message)


# Module-level singleton
manager = ConnectionManager()
