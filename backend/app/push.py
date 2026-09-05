"""Web Push support.

Generates (once) and persists a VAPID keypair used to sign push messages.
Browsers use the public half (as `applicationServerKey`) when the user
subscribes; we use the private half to sign every push we send, so the
push service (e.g. Google's FCM endpoint behind the scenes for Chrome)
can verify it really came from this server.
"""
import base64
import json
import logging
from asyncio import to_thread

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid02
from pywebpush import WebPushException, webpush
from sqlmodel import Session, select

from app.config import BASE_DIR, VAPID_CLAIMS_EMAIL
from app.models import PushSubscription

logger = logging.getLogger("push")

VAPID_PRIVATE_KEY_PATH = BASE_DIR / "vapid_private_key.pem"


def _get_vapid() -> Vapid02:
    if VAPID_PRIVATE_KEY_PATH.exists():
        return Vapid02.from_file(str(VAPID_PRIVATE_KEY_PATH))
    vapid = Vapid02()
    vapid.generate_keys()
    vapid.save_key(str(VAPID_PRIVATE_KEY_PATH))
    return vapid


def get_public_key_b64url() -> str:
    """Returns the VAPID public key in the raw, base64url form browsers
    expect for PushManager.subscribe({ applicationServerKey })."""
    vapid = _get_vapid()
    raw = vapid.public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def send_push_to_user(session: Session, user_id: str, payload: dict) -> None:
    """Fire a push notification to every device/browser the user has
    subscribed on. Silently drops subscriptions the push service reports
    as gone (410/404) -- that just means the user uninstalled/cleared
    the app on that device. Any other failure (bad keys, network errors,
    malformed subscription data) is logged and skipped rather than
    raised, so a single broken subscription can never take down a call
    or chat message for everyone else."""
    subs = session.exec(select(PushSubscription).where(PushSubscription.user_id == user_id)).all()
    if not subs:
        return

    dead_ids = []

    for sub in subs:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(payload),
                vapid_private_key=str(VAPID_PRIVATE_KEY_PATH),
                vapid_claims={"sub": f"mailto:{VAPID_CLAIMS_EMAIL}"},
            )
        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                dead_ids.append(sub.id)
            else:
                logger.warning("Push failed for %s (endpoint %s): %s", user_id, sub.endpoint[:60], exc)
        except Exception as exc:  # noqa: BLE001 - deliberately broad, see docstring
            # Covers e.g. ValueError from a malformed/corrupt subscription
            # key that fails at the local encryption step, before any
            # network request is even made.
            logger.warning("Push encoding failed for %s (endpoint %s): %s", user_id, sub.endpoint[:60], exc)

    if dead_ids:
        for sub_id in dead_ids:
            obj = session.get(PushSubscription, sub_id)
            if obj:
                session.delete(obj)
        session.commit()


async def send_push_to_user_async(session: Session, user_id: str, payload: dict) -> None:
    """Async wrapper: each webpush() call is a blocking HTTP request, so
    running this directly inside a WebSocket handler would stall every
    other connection on the same event loop for its duration. Runs it in
    a worker thread instead."""
    await to_thread(send_push_to_user, session, user_id, payload)
