"""Central configuration for the calling backend.

All values can be overridden via environment variables so the same code
works in dev and production without edits.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Auth ---
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me-in-production")
JWT_ALGORITHM = "HS256"
try:
    JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "10080"))
except ValueError:
    JWT_EXPIRE_MINUTES = 10080  # 7 days

# --- Database ---
DB_PATH = BASE_DIR / "data.db"
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DB_PATH}")

# --- Static frontend ---
WEBAPP_DIR = BASE_DIR / "webapp"

# --- Web Push (VAPID) ---
# Contact address delivered to push services in the signed claim; some
# push providers use it to reach you if your server is misbehaving.
VAPID_CLAIMS_EMAIL = os.environ.get("VAPID_CLAIMS_EMAIL", "admin@example.com")

# --- WebRTC ICE servers sent to the frontend ---
# Public STUN works for dev. For production behind NAT/firewalls you MUST
# run/point to a TURN server (e.g. coturn) or many calls will simply fail
# to connect audio/video.
ICE_SERVERS = [
    {"urls": ["stun:stun.l.google.com:19302"]},
    # Example TURN entry (fill in and uncomment for production):
    # {
    #     "urls": ["turn:your-turn-server.example.com:3478"],
    #     "username": os.environ.get("TURN_USERNAME", ""),
    #     "credential": os.environ.get("TURN_CREDENTIAL", ""),
    # },
]
