from pydantic import BaseModel, Field
from typing import Literal, Any
import uuid


def new_id() -> str:
    return uuid.uuid4().hex[:12]


# ── REST request bodies ───────────────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    name: str = Field(default="", max_length=80)
    mode: Literal["p2p", "room"] = "room"
    host_display_name: str = Field(default="Host", max_length=40)


class JoinRoomRequest(BaseModel):
    display_name: str = Field(default="Guest", max_length=40)


# ── REST response bodies ──────────────────────────────────────────────────────

class RoomInfo(BaseModel):
    room_id: str
    name: str
    mode: str
    peer_count: int


class JoinResponse(BaseModel):
    room_id: str
    peer_id: str
    display_name: str
    ice_servers: list[dict]


class PeerInfo(BaseModel):
    peer_id: str
    display_name: str
    joined_at: float


# ── WebSocket message frames ──────────────────────────────────────────────────

class WsMessage(BaseModel):
    """All WS frames share this envelope."""
    type: str
    payload: Any = None
    to: str | None = None          # target peer_id (for direct signals)
