import hashlib
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET
from app.db import get_session
from app.models import User

security = HTTPBearer(auto_error=False)


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    """PBKDF2-SHA256 hashing using only the stdlib (no extra native deps)."""
    salt = salt or os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000)
    return digest.hex(), salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    computed, _ = hash_password(password, salt)
    return computed == password_hash


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return user_id


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: Session = Depends(get_session),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    user_id = decode_token(credentials.credentials)
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


def get_current_user_id_ws(token: str) -> str:
    """Same as decode_token, used explicitly from the WebSocket route
    where the token arrives as a query param instead of a header."""
    return decode_token(token)
