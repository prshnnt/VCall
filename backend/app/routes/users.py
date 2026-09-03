import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlmodel import Session

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.db import get_session
from app.models import User
from app.ws.connection_manager import manager

router = APIRouter(prefix="/api", tags=["users"])

USER_ID_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,32}$")


class RegisterRequest(BaseModel):
    user_id: str
    password: str
    display_name: str

    @field_validator("user_id")
    @classmethod
    def valid_user_id(cls, v: str) -> str:
        if not USER_ID_RE.match(v):
            raise ValueError("user_id must be 3-32 chars: letters, numbers, . _ -")
        return v

    @field_validator("password")
    @classmethod
    def valid_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    user_id: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user_id: str
    display_name: str


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest, session: Session = Depends(get_session)):
    existing = session.get(User, req.user_id)
    if existing:
        raise HTTPException(status_code=409, detail="user_id already taken")
    password_hash, salt = hash_password(req.password)
    user = User(
        user_id=req.user_id,
        display_name=req.display_name or req.user_id,
        password_hash=password_hash,
        salt=salt,
    )
    session.add(user)
    session.commit()
    token = create_access_token(user.user_id)
    return AuthResponse(token=token, user_id=user.user_id, display_name=user.display_name)


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, session: Session = Depends(get_session)):
    user = session.get(User, req.user_id)
    if not user or not verify_password(req.password, user.password_hash, user.salt):
        raise HTTPException(status_code=401, detail="Invalid user_id or password")
    token = create_access_token(user.user_id)
    return AuthResponse(token=token, user_id=user.user_id, display_name=user.display_name)


@router.get("/users/me")
def get_me(current: User = Depends(get_current_user)):
    return {"user_id": current.user_id, "display_name": current.display_name}


@router.get("/users/{user_id}")
def lookup_user(user_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": user.user_id,
        "display_name": user.display_name,
        "online": manager.is_online(user.user_id),
    }
