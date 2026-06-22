"""
REST endpoints for room lifecycle.

POST /rooms                  → create a room, get room_id + peer_id (as host)
GET  /rooms/{room_id}        → room info + peer count
POST /rooms/{room_id}/join   → join existing room, get peer_id + ICE servers
GET  /rooms/{room_id}/peers  → list peers in room
GET  /turn-credentials       → fetch fresh TURN creds (called by frontend)
"""

import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic_settings import BaseSettings

from config import get_settings
from models import CreateRoomRequest, JoinRoomRequest, JoinResponse, RoomInfo, PeerInfo
from redis_client import (
    create_room, get_room_info, add_peer_to_room,
    get_room_peers, get_peer_count, remove_peer_from_room,
)
from turn_service import get_turn_credentials

router = APIRouter(prefix="/api")


def _new_id(n: int = 12) -> str:
    return uuid.uuid4().hex[:n]


# ── TURN credentials ──────────────────────────────────────────────────────────

@router.get("/turn-credentials")
async def turn_credentials():
    """Return fresh Cloudflare TURN ICE server credentials."""
    try:
        servers = await get_turn_credentials()
    except Exception as exc:
        # Log but don't crash — frontend will use STUN-only fallback
        import logging
        logging.getLogger(__name__).error("TURN fetch failed: %s", exc)
        servers = [{"urls": ["stun:stun.l.google.com:19302"]}]
    return {"iceServers": servers}


# ── Room CRUD ─────────────────────────────────────────────────────────────────

@router.post("/rooms", response_model=JoinResponse, status_code=201)
async def create_room_endpoint(body: CreateRoomRequest):
    room_id = _new_id(8)
    host_peer_id = _new_id(12)

    await create_room(
        room_id=room_id,
        name=body.name or f"Room-{room_id}",
        host_id=host_peer_id,
        mode=body.mode,
    )
    await add_peer_to_room(room_id, host_peer_id, body.host_display_name)

    ice_servers = await get_turn_credentials()

    return JoinResponse(
        room_id=room_id,
        peer_id=host_peer_id,
        display_name=body.host_display_name,
        ice_servers=ice_servers,
    )


@router.get("/rooms/{room_id}", response_model=RoomInfo)
async def get_room(room_id: str):
    info = await get_room_info(room_id)
    if not info:
        raise HTTPException(status_code=404, detail="Room not found")
    count = await get_peer_count(room_id)
    return RoomInfo(
        room_id=room_id,
        name=info.get("name", room_id),
        mode=info.get("mode", "room"),
        peer_count=count,
    )


@router.post("/rooms/{room_id}/join", response_model=JoinResponse)
async def join_room(room_id: str, body: JoinRoomRequest):
    info = await get_room_info(room_id)
    if not info:
        raise HTTPException(status_code=404, detail="Room not found")

    settings = get_settings()
    count = await get_peer_count(room_id)

    if info.get("mode") == "p2p" and count >= 2:
        raise HTTPException(status_code=409, detail="1-on-1 call is already full")

    if count >= settings.room_max_peers:
        raise HTTPException(status_code=409, detail="Room is full")

    peer_id = _new_id(12)
    await add_peer_to_room(room_id, peer_id, body.display_name)

    ice_servers = await get_turn_credentials()

    return JoinResponse(
        room_id=room_id,
        peer_id=peer_id,
        display_name=body.display_name,
        ice_servers=ice_servers,
    )


@router.get("/rooms/{room_id}/peers", response_model=list[PeerInfo])
async def list_peers(room_id: str):
    info = await get_room_info(room_id)
    if not info:
        raise HTTPException(status_code=404, detail="Room not found")
    peers = await get_room_peers(room_id)
    return [
        PeerInfo(
            peer_id=p["peer_id"],
            display_name=p.get("display_name", "Unknown"),
            joined_at=float(p.get("joined_at", 0)),
        )
        for p in peers
    ]


@router.delete("/rooms/{room_id}/peers/{peer_id}", status_code=204)
async def leave_room(room_id: str, peer_id: str):
    """Graceful leave via REST (also handled via WS disconnect)."""
    await remove_peer_from_room(room_id, peer_id)
