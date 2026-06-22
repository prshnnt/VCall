# Video Chat Backend

FastAPI + Redis + Cloudflare TURN — WebRTC signaling server.

## Architecture

```
Browser A                      Backend (FastAPI)                    Browser B
   │                                  │                                  │
   │  POST /api/rooms  ───────────►   │  create_room (Redis)             │
   │  ◄──── { room_id, peer_id }      │                                  │
   │                                  │                                  │
   │  WS /ws/{room_id}/{peer_idA} ──► │  register WS                     │
   │  ◄── room-state (peers=[])       │                                  │
   │                                  │                                  │
   │                         POST /api/rooms/{id}/join  ◄───────────────│
   │                                  │  ◄── { peer_id: B }              │
   │                                  │                                  │
   │                                  │  WS /ws/{room_id}/{peer_idB} ◄── │
   │  ◄── peer-joined (B)             │  ◄── room-state (peers=[A])  ──► │
   │                                  │                                  │
   │  {type:"offer", to:B, sdp} ────► │  relay to B  ────────────────► │
   │                            ◄──── │  ◄── {type:"answer", to:A}       │
   │  ◄── answer from B               │                                  │
   │  ICE candidates ◄──────────────► │ ◄──────────────────────────────► │
   │                                  │                                  │
   │◄═══════════════ P2P video/audio (direct, bypasses server) ═════════►│
```

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Copy env and fill in values
cp .env.example .env
# Edit .env with your Cloudflare + Redis credentials

# 3. Start Redis (if local)
docker run -d -p 6379:6379 redis:7-alpine

# 4. Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 5. Open API docs
open http://localhost:8000/docs
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CF_ACCOUNT_ID` | No* | Cloudflare Account ID |
| `CF_TURN_TOKEN` | No* | Cloudflare Calls API token |
| `CF_TURN_TTL` | No | TURN credential TTL (default 86400s) |
| `REDIS_URL` | Yes | Redis connection URL |
| `ROOM_MAX_PEERS` | No | Max peers per room (default 10) |
| `SESSION_TTL` | No | Room session TTL in seconds (default 3600) |

*Without CF credentials the server falls back to Google public STUN servers.

## Cloudflare TURN Setup

1. Go to Cloudflare Dashboard → **Calls** → **TURN**
2. Create a new TURN key
3. Copy the **Key ID** → set as `CF_TURN_TOKEN`
4. Copy your **Account ID** → set as `CF_ACCOUNT_ID`

## API Reference

### REST

| Method | Path | Description |
|---|---|---|
| POST | `/api/rooms` | Create room (returns peer_id for host) |
| GET | `/api/rooms/{id}` | Get room info |
| POST | `/api/rooms/{id}/join` | Join room (returns peer_id) |
| GET | `/api/rooms/{id}/peers` | List peers in room |
| DELETE | `/api/rooms/{id}/peers/{pid}` | Leave room (REST) |
| GET | `/api/turn-credentials` | Get fresh ICE server list |
| GET | `/health` | Health check |

### WebSocket

Connect: `ws://host/ws/{room_id}/{peer_id}`

**Send:**
```json
{ "type": "offer",         "to": "<peer_id>", "payload": { "sdp": "..." } }
{ "type": "answer",        "to": "<peer_id>", "payload": { "sdp": "..." } }
{ "type": "ice-candidate", "to": "<peer_id>", "payload": { "candidate": "..." } }
{ "type": "ping" }
{ "type": "leave" }
```

**Receive:**
```json
{ "type": "room-state",   "peers": [...], "mode": "room" }
{ "type": "peer-joined",  "peer_id": "...", "display_name": "..." }
{ "type": "peer-left",    "peer_id": "..." }
{ "type": "offer",        "from": "...", "payload": { "sdp": "..." } }
{ "type": "answer",       "from": "...", "payload": { "sdp": "..." } }
{ "type": "ice-candidate","from": "...", "payload": { "candidate": "..." } }
{ "type": "pong" }
{ "type": "error",        "message": "..." }
```

## File Structure

```
videochat/
├── main.py           # FastAPI app, lifespan, CORS
├── config.py         # Settings via pydantic-settings + .env
├── models.py         # Pydantic request/response models
├── redis_client.py   # Redis helpers (rooms, peers, signal queues)
├── turn_service.py   # Cloudflare TURN credential fetcher
├── ws_manager.py     # WebSocket connection manager + relay
├── routes_room.py    # REST room endpoints
├── routes_ws.py      # WebSocket signaling endpoint
├── requirements.txt
└── .env.example
```
