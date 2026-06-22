"""
Cloudflare TURN credential helper.

Cloudflare Calls TURN REST API:
  POST https://rtc.live.cloudflare.com/v1/turn/keys/{key_id}/credentials/generate

Docs: https://developers.cloudflare.com/calls/turn/

The response returns short-lived ICE server credentials that are passed to
the browser's RTCPeerConnection so it can punch through NAT/firewalls.
"""

import httpx
from config import get_settings

_CF_TURN_BASE = "https://rtc.live.cloudflare.com/v1/turn/keys"


async def get_turn_credentials() -> list[dict]:
    """
    Fetch fresh TURN credentials from Cloudflare.
    Returns a list ready to drop into RTCPeerConnection iceServers.
    Falls back to Google's public STUN if CF is not configured.
    """
    settings = get_settings()

    # ── Fallback: public STUN only (no TURN) ────────────────────────────────
    if not settings.cf_account_id or not settings.cf_turn_token:
        return [{"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}]

    url = f"{_CF_TURN_BASE}/{settings.cf_turn_token}/credentials/generate"

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {settings.cf_turn_token}",
                "Content-Type": "application/json",
            },
            json={"ttl": settings.cf_turn_ttl},
        )
        resp.raise_for_status()
        data = resp.json()

    # Cloudflare returns: { iceServers: [ { urls, username, credential } ] }
    ice_servers: list[dict] = data.get("iceServers", [])

    # Always add STUN as first entry for fastest connectivity checks
    stun = {"urls": ["stun:stun.cloudflare.com:3478"]}
    if stun not in ice_servers:
        ice_servers.insert(0, stun)

    return ice_servers
