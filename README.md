# CallChat — WebRTC calling + minimal chat

A minimal calling app: register with a user ID, call another registered
user by their ID (voice or video), and exchange short chat messages —
like a phone dialer with SMS. All calls/messages are logged per-user in
a database, not just kept in browser memory.

- **Backend**: Python + FastAPI, managed with `uv`. Handles auth, user
  lookup, call/message history, and WebRTC **signaling** over a
  WebSocket (it never touches the actual audio/video — that's peer-to-peer).
- **Frontend**: React (Vite) + Bootstrap. Builds into `backend/webapp/`,
  so in production it's all one process/one port.

## Project layout

```
/backend         FastAPI app (uv-managed)
  /app
    main.py       entrypoint, mounts routes + serves the built frontend
    config.py     secrets, DB path, ICE server list
    db.py         SQLModel engine/session
    models.py     User, Call, Message tables
    auth.py       password hashing + JWT
    routes/       REST: users, calls, messages
    ws/           WebSocket signaling + connection manager
  /webapp         <- built frontend lands here (generated, don't edit by hand)
/frontend         React app (Vite)
  /src
    api/          REST client
    ws/           WebSocket context (global connection, pub/sub)
    call/         Call state machine (wires signaling + WebRTC together)
    webrtc/       RTCPeerConnection wrapper
    pages/        Login, Register, Dialer, CallScreen, Chat
    components/   Navbar, IncomingCallModal
```

## Running it (development)

Two processes, so hot-reload works on both sides.

**Backend:**
```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Open the Vite dev URL it prints (usually `http://localhost:5173`). The
dev server proxies `/api` and `/ws` to the backend on port 8000
(see `frontend/vite.config.js`), so there's no CORS hassle.

Open two browser windows (or one normal + one incognito) and register
two different user IDs to test calling between them.

## Running it (production-style, single process)

```bash
cd frontend
npm install
npm run build          # outputs into ../backend/webapp
cd ../backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Now `http://localhost:8000` serves the whole app — API, WebSocket, and
the built React frontend — from one FastAPI process.

## Important: you need a TURN server for real-world use

The app ships with only a public STUN server
(`stun:stun.l.google.com:19302`), which is enough for two browsers on
open networks. **Across most real networks (behind NAT/firewalls,
mobile carriers, corporate networks), calls will fail to connect media
without a TURN server.** Run something like
[coturn](https://github.com/coturn/coturn) and add its URL/credentials
to `ICE_SERVERS` in `backend/app/config.py`.

## How calling works (signaling flow)

1. User A looks up User B's ID, clicks call → app opens/reuses a
   WebSocket and sends `call:invite`.
2. If B is online and free, the server relays the invite to B and B
   sees an incoming-call modal (rings) no matter which page they're on.
3. B accepts → server relays `call:accept` to A.
4. A creates a `RTCPeerConnection`, grabs mic/camera, creates an SDP
   offer, sends it as `webrtc:offer`.
5. B receives the offer, creates its own peer connection + answer,
   sends `webrtc:answer`.
6. Both sides trade `webrtc:ice` candidates as they're discovered.
7. Once ICE connects, audio/video flows directly between browsers (or
   via TURN relay) — the backend is never in the media path.
8. Either side can `call:hangup`; the call is logged with its outcome
   (`completed` / `missed` / `rejected` / `cancelled`) in the database.

Chat messages go over the same WebSocket (`chat:message`) and are
persisted to the database immediately, with a REST fallback
(`POST /api/messages`) if the socket happens to be down.

## Known simplifications (minimal by design)

- One active session per user (opening a second tab disconnects the first).
- No push notifications — a user only gets a call/message live if their
  tab is open and the WebSocket is connected.
- No group calls or group chat — one-to-one only.
- No read receipts beyond `delivered`.
- Passwords hashed with PBKDF2-SHA256 (stdlib only, no native deps) —
  fine for a minimal app, but consider `argon2`/`bcrypt` for production.
