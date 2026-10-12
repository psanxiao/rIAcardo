from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid


class UserRegister(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    user_id: str
    email: str
    created_at: Optional[str] = None


class UserProfile(BaseModel):
    user_id: str
    email: str
    full_name: Optional[str] = None
    garmin_connected: bool
    garmin_email: Optional[str] = None
    google_calendar_id: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    google_calendar_id: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None
