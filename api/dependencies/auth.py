from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from api.services.auth_service import decode_access_token
from api.dependencies.database import get_db_connection

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    FastAPI dependency that decodes the JWT token from the Authorization header
    and returns the user_id. Raises 401 if the token is invalid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    return user_id
