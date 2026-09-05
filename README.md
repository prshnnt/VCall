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
    config.py     secrets, DB path, ICE server list, VAPID contact email
    db.py         SQLModel engine/session
    models.py     User, Call, Message, PushSubscription tables
    auth.py       password hashing + JWT
    push.py       VAPID key management + sending Web Push notifications
    routes/       REST: users, calls, messages, push (subscribe/unsubscribe)
    ws/           WebSocket signaling + connection manager
  vapid_private_key.pem   auto-generated on first run (gitignored)
  /webapp         <- built frontend lands here (generated, don't edit by hand)
/frontend         React app (Vite)
  /src
    api/          REST client
    ws/           WebSocket context (global connection, pub/sub)
    call/         Call state machine (wires signaling + WebRTC together)
    webrtc/       RTCPeerConnection wrapper
    push/         Push subscription helper (permission + subscribe/unsubscribe)
    pages/        Login, Register, Dialer, CallScreen, Chat
    components/   Navbar, IncomingCallModal, InstallPrompt
    sw.js         Custom service worker (precache + push + notification click)
  /public
    icon-192.png, icon-512.png, icon-maskable-512.png   PWA icons
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

## Installing it as an app (PWA)

This is a full Progressive Web App: it ships a web manifest and a
service worker, so it can be **installed** like a native app and can
show notifications even when it isn't the focused tab.

- **Desktop Chrome/Edge**: an install icon appears in the address bar,
  or use the in-app "Install CallChat" banner that shows up after login.
- **Android Chrome**: same in-app banner triggers the native install
  prompt; the app then appears on the home screen/app drawer.
- **iOS Safari**: Apple doesn't support the install-prompt API, so the
  app shows manual instructions instead — tap the **Share** icon, then
  **Add to Home Screen**.

Once installed, incoming calls and chat messages can notify you even
when the app isn't open, via **Web Push**:

- The backend auto-generates a VAPID keypair on first run
  (`backend/vapid_private_key.pem` — back this up if you redeploy,
  otherwise existing browser subscriptions become invalid and users
  need to re-subscribe).
- After logging in, the app asks for notification permission once. If
  granted, it registers a push subscription with the backend
  (`POST /api/push/subscribe`).
- An incoming call or new chat message triggers a push
  (`app/push.py` → `send_push_to_user_async`), which the service worker
  (`frontend/src/sw.js`) turns into an OS-level notification, even with
  the tab closed. Tapping it opens/focuses the app.

**Important — Web Push requires a secure context.** It works on
`http://localhost` for local development, but in production you must
serve the app over **HTTPS** (a plain `http://` deployment on a LAN IP,
for example, will not be able to subscribe to push at all). Put it
behind a reverse proxy (nginx/Caddy) with TLS, or a platform that
terminates HTTPS for you.

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

If the callee's WebSocket drops while a call is still ringing (e.g. the
browser suspended a backgrounded tab, or the installed app was fully
closed), the server doesn't immediately give up — it holds the call open
for a short grace window (15s) waiting for them to reconnect, since the
push notification that was sent alongside the invite is exactly what's
meant to bring them back. If they reconnect in time, the pending invite
is resent automatically; otherwise the caller gets a "no answer".

Chat messages go over the same WebSocket (`chat:message`) and are
persisted to the database immediately, with a REST fallback
(`POST /api/messages`) if the socket happens to be down.

## Known simplifications (minimal by design)

- One active session per user (opening a second tab disconnects the first).
- No group calls or group chat — one-to-one only.
- No read receipts beyond `delivered`.
- Passwords hashed with PBKDF2-SHA256 (stdlib only, no native deps) —
  fine for a minimal app, but consider `argon2`/`bcrypt` for production.
- Push notification delivery depends on the browser/OS's push service
  being reachable (e.g. Google's FCM backs Chrome's Push API) — some
  networks/firewalls block this.
