from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.auth import get_current_user
from app.db import get_session
from app.models import PushSubscription, User
from app.push import get_public_key_b64url

router = APIRouter(prefix="/api/push", tags=["push"])


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: SubscriptionKeys


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.get("/public-key")
def public_key():
    return {"publicKey": get_public_key_b64url()}


@router.post("/subscribe")
def subscribe(
    req: SubscribeRequest,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    existing = session.exec(select(PushSubscription).where(PushSubscription.endpoint == req.endpoint)).first()
    if existing:
        # Same browser subscribing again (e.g. re-login, or as a different
        # user on a shared device) -- just repoint it at the current user.
        existing.user_id = current.user_id
        existing.p256dh = req.keys.p256dh
        existing.auth = req.keys.auth
        session.add(existing)
    else:
        session.add(
            PushSubscription(
                user_id=current.user_id,
                endpoint=req.endpoint,
                p256dh=req.keys.p256dh,
                auth=req.keys.auth,
            )
        )
    session.commit()
    return {"ok": True}


@router.post("/unsubscribe")
def unsubscribe(
    req: UnsubscribeRequest,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    existing = session.exec(
        select(PushSubscription).where(
            PushSubscription.endpoint == req.endpoint,
            PushSubscription.user_id == current.user_id,
        )
    ).first()
    if existing:
        session.delete(existing)
        session.commit()
    return {"ok": True}
