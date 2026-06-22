# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Development Setup
Install deps:
pip install -r requirements.txt
or uv sync
Ensure Redis running (7+):
redis-server
or docker-compose up

Running the App
Local dev:
python chat.py
Open http://localhost:9080
Docker:
docker-compose up
App at http://localhost:9080

Architecture
Redis Streams chat using:
FastAPI for HTTP/WS
Redis Streams for msgs
WebSockets for realtime
Jinja2 for HTML

Key comps
chat.py:
FastAPI app with Redis lifespan
WS endpoints: /ws (clients), /ws/moderator (mod)
HTTP endpoints: / and /moderator
Context vars for tenant (hostname+room)
Redis stream ops
Custom header middleware

Templates/
chat.html: client UI
moderator_chat.html: mod view (readonly)

Redis model
Streams: {tenant}:stream for msgs
Sets: {tenant}:users for connected users
Tenant ID: hostname_with_underscores:room

Env vars
REDIS_HOST: Redis host (default localhost, docker: redis)
REDIS_PORT: Redis port (default 6379)
CHAT_HOST_IP: override local IP

Commands
Tests: none yet, use pytest if added
Lint: none, consider ruff/flake8
Format: none, consider black/isort
Type: none, consider mypy/pyright

Notes
Uses uvloop for asyncio perf
WS XREAD block 5s
History limit: NUM_PREVIOUS (30)
Stream trim: STREAM_MAX_LEN (1000)
Mod WS only username moderator, reads multi-stream