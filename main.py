"""
Video Chat Backend — FastAPI
=============================
Start with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

Or with multiple workers (Redis required for cross-worker signaling):
    uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from redis_client import get_redis, close_redis
from routes_room import router as room_router
from routes_ws import router as ws_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    settings = get_settings()
    logger.info("Starting video-chat backend")
    logger.info("Redis: %s", settings.redis_url)
    logger.info("CF TURN configured: %s", bool(settings.cf_account_id))

    # Eagerly open Redis connection to fail fast if misconfigured
    try:
        r = await get_redis()
        await r.ping()
        logger.info("Redis connection OK")
    except Exception as exc:
        logger.error("Redis connection FAILED: %s", exc)
        logger.warning("Continuing without Redis — signaling will be in-memory only")

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    await close_redis()
    logger.info("Shutdown complete")


app = FastAPI(
    title="Video Chat API",
    version="1.0.0",
    description="WebRTC signaling + room management backend",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# In production restrict origins to your actual domain(s).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(room_router)
app.include_router(ws_router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    try:
        r = await get_redis()
        await r.ping()
        redis_ok = True
    except Exception:
        redis_ok = False
    return {"status": "ok", "redis": redis_ok}


@app.get("/")
async def root():
    return {
        "service": "video-chat-backend",
        "version": "1.0.0",
        "docs": "/docs",
    }
