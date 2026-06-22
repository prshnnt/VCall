"""
Redis helper — one async connection pool for the whole app.
All room state and signaling is stored here so the server can be
horizontally scaled (multiple uvicorn workers / processes).

Key schema
──────────
  room:{room_id}:info          HASH   name, created_at, host_id, mode
  room:{room_id}:peers         SET    peer_ids currently in room
  room:{room_id}:peer:{pid}    HASH   display_name, joined_at
  peer:{peer_id}:room          STRING room_id this peer belongs to
  signal:{target_peer_id}      LIST   JSON-encoded signaling messages (RPUSH/BLPOP)
"""

import json
import redis.asyncio as aioredis
from config import get_settings

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        settings = get_settings()
        _redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None


# ── Room helpers ─────────────────────────────────────────────────────────────

async def create_room(room_id: str, name: str, host_id: str, mode: str) -> None:
    r = await get_redis()
    settings = get_settings()
    pipe = r.pipeline()
    pipe.hset(f"room:{room_id}:info", mapping={
        "name": name,
        "host_id": host_id,
        "mode": mode,          # "p2p" (1-on-1) or "room"
        "created_at": __import__("time").time(),
    })
    pipe.expire(f"room:{room_id}:info", settings.session_ttl)
    await pipe.execute()


async def get_room_info(room_id: str) -> dict | None:
    r = await get_redis()
    info = await r.hgetall(f"room:{room_id}:info")
    return info or None


async def add_peer_to_room(room_id: str, peer_id: str, display_name: str) -> None:
    r = await get_redis()
    settings = get_settings()
    import time
    pipe = r.pipeline()
    pipe.sadd(f"room:{room_id}:peers", peer_id)
    pipe.expire(f"room:{room_id}:peers", settings.session_ttl)
    pipe.hset(f"room:{room_id}:peer:{peer_id}", mapping={
        "display_name": display_name,
        "joined_at": time.time(),
    })
    pipe.expire(f"room:{room_id}:peer:{peer_id}", settings.session_ttl)
    pipe.set(f"peer:{peer_id}:room", room_id, ex=settings.session_ttl)
    await pipe.execute()


async def remove_peer_from_room(room_id: str, peer_id: str) -> None:
    r = await get_redis()
    pipe = r.pipeline()
    pipe.srem(f"room:{room_id}:peers", peer_id)
    pipe.delete(f"room:{room_id}:peer:{peer_id}")
    pipe.delete(f"peer:{peer_id}:room")
    pipe.delete(f"signal:{peer_id}")
    await pipe.execute()


async def get_room_peers(room_id: str) -> list[dict]:
    r = await get_redis()
    peer_ids = await r.smembers(f"room:{room_id}:peers")
    peers = []
    for pid in peer_ids:
        info = await r.hgetall(f"room:{room_id}:peer:{pid}")
        if info:
            peers.append({"peer_id": pid, **info})
    return peers


async def get_peer_count(room_id: str) -> int:
    r = await get_redis()
    return await r.scard(f"room:{room_id}:peers")


async def peer_room(peer_id: str) -> str | None:
    r = await get_redis()
    return await r.get(f"peer:{peer_id}:room")


# ── Signaling queue helpers ───────────────────────────────────────────────────

async def push_signal(target_peer_id: str, message: dict) -> None:
    """Push a signaling message into the target peer's queue."""
    r = await get_redis()
    settings = get_settings()
    await r.rpush(f"signal:{target_peer_id}", json.dumps(message))
    await r.expire(f"signal:{target_peer_id}", settings.session_ttl)


async def pop_signal(peer_id: str, timeout: float = 0) -> dict | None:
    """
    Pop the next signaling message for peer_id.
    timeout=0 → non-blocking (returns None if empty).
    timeout>0 → blocking pop (used in long-poll fallback).
    """
    r = await get_redis()
    if timeout:
        result = await r.blpop(f"signal:{peer_id}", timeout=timeout)
        if result:
            _, raw = result
            return json.loads(raw)
        return None
    raw = await r.lpop(f"signal:{peer_id}")
    return json.loads(raw) if raw else None


async def flush_signals(peer_id: str) -> list[dict]:
    """Drain all pending signals for a peer in one shot."""
    r = await get_redis()
    pipe = r.pipeline()
    pipe.lrange(f"signal:{peer_id}", 0, -1)
    pipe.delete(f"signal:{peer_id}")
    results, _ = await pipe.execute()
    return [json.loads(m) for m in results]
