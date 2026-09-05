from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, and_, or_, select

from app.auth import get_current_user
from app.db import get_session
from app.models import Message, User
from app.push import send_push_to_user_async
from app.ws.connection_manager import manager

router = APIRouter(prefix="/api/messages", tags=["messages"])


class SendMessageRequest(BaseModel):
    to: str
    body: str


@router.get("/threads")
def list_threads(session: Session = Depends(get_session), current: User = Depends(get_current_user)):
    """Distinct set of people the current user has exchanged messages with,
    most-recent message first."""
    stmt = (
        select(Message)
        .where(or_(Message.sender_id == current.user_id, Message.receiver_id == current.user_id))
        .order_by(Message.sent_at.desc())
    )
    seen = {}
    for m in session.exec(stmt).all():
        peer = m.receiver_id if m.sender_id == current.user_id else m.sender_id
        if peer not in seen:
            seen[peer] = {"peer": peer, "lastMessage": m.body, "sentAt": m.sent_at.isoformat()}
    return list(seen.values())


@router.get("/{peer_id}")
def get_thread(
    peer_id: str,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
    limit: int = 200,
):
    stmt = (
        select(Message)
        .where(
            or_(
                and_(Message.sender_id == current.user_id, Message.receiver_id == peer_id),
                and_(Message.sender_id == peer_id, Message.receiver_id == current.user_id),
            )
        )
        .order_by(Message.sent_at.asc())
        .limit(limit)
    )
    messages = session.exec(stmt).all()
    return [
        {
            "id": m.id,
            "from": m.sender_id,
            "to": m.receiver_id,
            "body": m.body,
            "sentAt": m.sent_at.isoformat(),
            "mine": m.sender_id == current.user_id,
        }
        for m in messages
    ]


@router.post("")
async def send_message(
    req: SendMessageRequest,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    """REST fallback for sending a message (e.g. if the WS is briefly down).
    The live WS path in signaling.py is preferred for real-time delivery."""
    body = req.body.strip()
    message = Message(sender_id=current.user_id, receiver_id=req.to, body=body)
    session.add(message)
    session.commit()
    session.refresh(message)

    delivered = await manager.send_json(req.to, {
        "type": "chat:message",
        "from": current.user_id,
        "payload": {"id": message.id, "body": body, "sentAt": message.sent_at.isoformat()},
    })
    if delivered:
        message.delivered = True
        session.add(message)
        session.commit()

    preview = body if len(body) <= 120 else body[:117] + "..."
    await send_push_to_user_async(session, req.to, {
        "title": f"Message from {current.user_id}",
        "body": preview,
        "tag": f"chat-{current.user_id}",
        "data": {"kind": "message", "peer": current.user_id, "url": f"/chats?peer={current.user_id}"},
    })

    return {"id": message.id, "sentAt": message.sent_at.isoformat()}
