from fastapi import APIRouter, Depends
from sqlmodel import Session, or_, select

from app.auth import get_current_user
from app.db import get_session
from app.models import Call, User

router = APIRouter(prefix="/api/calls", tags=["calls"])


@router.get("/history")
def call_history(
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
    limit: int = 50,
):
    stmt = (
        select(Call)
        .where(or_(Call.caller_id == current.user_id, Call.callee_id == current.user_id))
        .order_by(Call.started_at.desc())
        .limit(limit)
    )
    calls = session.exec(stmt).all()
    return [
        {
            "id": c.id,
            "peer": c.callee_id if c.caller_id == current.user_id else c.caller_id,
            "direction": "outgoing" if c.caller_id == current.user_id else "incoming",
            "callType": c.call_type,
            "status": c.status,
            "startedAt": c.started_at.isoformat(),
            "endedAt": c.ended_at.isoformat() if c.ended_at else None,
        }
        for c in calls
    ]
