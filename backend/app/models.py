from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    # user_id is the human-chosen handle people call each other by,
    # e.g. "priya123". It doubles as the primary key.
    user_id: str = Field(primary_key=True, index=True)
    display_name: str
    password_hash: str
    salt: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Call(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    caller_id: str = Field(index=True)
    callee_id: str = Field(index=True)
    call_type: str = Field(default="audio")  # "audio" | "video"
    status: str = Field(default="missed")  # missed | completed | rejected | cancelled
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None


class PushSubscription(SQLModel, table=True):
    """One row per browser/device the user has enabled notifications on.
    A single user_id can have several (phone + laptop, etc)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    endpoint: str = Field(unique=True, index=True)
    p256dh: str
    auth: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sender_id: str = Field(index=True)
    receiver_id: str = Field(index=True)
    body: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    delivered: bool = Field(default=False)
    read: bool = Field(default=False)
