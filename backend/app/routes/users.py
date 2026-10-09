import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlmodel import Session, select

from app.auth import create_access_token, get_current_user
from app.db import get_session
from app.models import User, Contact
from app.ws.connection_manager import manager

router = APIRouter(prefix="/api", tags=["users"])

USER_ID_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,32}$")


class GoogleAuthRequest(BaseModel):
    token: str
    display_name: str


class ClaimUserIdRequest(BaseModel):
    user_id: str

    @field_validator("user_id")
    @classmethod
    def valid_user_id(cls, v: str) -> str:
        if not USER_ID_RE.match(v):
            raise ValueError("user_id must be 3-32 chars: letters, numbers, . _ -")
        return v


class AuthResponse(BaseModel):
    token: str
    user_id: str | None
    display_name: str
    needs_id_claim: bool = False


@router.post("/auth/google", response_model=AuthResponse)
def auth_google(req: GoogleAuthRequest, session: Session = Depends(get_session)):
    # In a production app, we would verify req.token with google-auth library.
    # For now, we assume the token is the Google ID.
    google_id = req.token 
    
    user = session.exec(select(User).where(User.google_id == google_id)).first()
    
    if not user:
        # Create user in "pending" state (we'll use a temporary user_id for the token)
        # since user_id is the PK, we use google_id as a placeholder until they claim one.
        # Better: Use a temporary prefix.
        temp_id = f"temp_{google_id}"
        user = User(
            user_id=temp_id,
            google_id=google_id,
            display_name=req.display_name,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    
    token = create_access_token(user.user_id, temporary=(user.user_id.startswith("temp_")))
    
    return AuthResponse(
        token=token, 
        user_id=user.user_id if not user.user_id.startswith("temp_") else None, 
        display_name=user.display_name,
        needs_id_claim=user.user_id.startswith("temp_")
    )


@router.post("/auth/claim-id", response_model=AuthResponse)
def claim_id(req: ClaimUserIdRequest, current: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not current.user_id.startswith("temp_"):
        raise HTTPException(status_code=400, detail="User already has a permanent ID")
    
    existing = session.get(User, req.user_id)
    if existing:
        raise HTTPException(status_code=409, detail="user_id already taken")
    
    # Update the user's primary key (user_id)
    # Since user_id is the PK, we have to delete and recreate or use a more complex update.
    # For SQLModel/SQLAlchemy, the cleanest way for a PK change is often delete/insert
    # if no other foreign keys are strictly blocking.
    
    old_id = current.user_id
    google_id = current.google_id
    display_name = current.display_name
    
    session.delete(current)
    session.commit()
    
    user = User(
        user_id=req.user_id,
        google_id=google_id,
        display_name=display_name,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    
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

# --- Contacts API ---

class ContactRequest(BaseModel):
    contact_user_id: str
    contact_name: Optional[str] = None

@router.post("/contacts")
def add_contact(req: ContactRequest, current: User = Depends(get_current_user), session: Session = Depends(get_session)):
    existing = session.exec(select(Contact).where(
        Contact.owner_id == current.user_id, 
        Contact.contact_user_id == req.contact_user_id
    )).first()
    if existing:
        return {"message": "Contact already exists"}
    
    contact = Contact(
        owner_id=current.user_id,
        contact_user_id=req.contact_user_id,
        contact_name=req.contact_name
    )
    session.add(contact)
    session.commit()
    return {"message": "Contact saved"}

@router.get("/contacts")
def list_contacts(current: User = Depends(get_current_user), session: Session = Depends(get_session)):
    contacts = session.exec(select(Contact).where(Contact.owner_id == current.user_id)).all()
    return contacts

@router.delete("/contacts/{contact_user_id}")
def remove_contact(contact_user_id: str, current: User = Depends(get_current_user), session: Session = Depends(get_session)):
    contact = session.exec(select(Contact).where(
        Contact.owner_id == current.user_id, 
        Contact.contact_user_id == contact_user_id
    )).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    session.delete(contact)
    session.commit()
    return {"message": "Contact removed"}
