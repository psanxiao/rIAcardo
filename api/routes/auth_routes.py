from fastapi import APIRouter, HTTPException, status, Depends, Request
from api.schemas.auth_schemas import UserRegister, UserLogin, Token, UserResponse, UserProfile, UserUpdate, PasswordChange
from api.services.auth_service import get_password_hash, verify_password, create_access_token
from api.dependencies.database import get_db_connection
from api.dependencies.auth import get_current_user
from api.dependencies.limiter import limiter

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, user_data: UserRegister):
    """Registers a new user with email and password."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        with conn.cursor() as cursor:
            # Check if user already exists
            cursor.execute("SELECT user_id FROM public.users WHERE email = %s", (user_data.email,))
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A user with this email already exists"
                )
            
            # Create user
            password_hash = get_password_hash(user_data.password)
            cursor.execute(
                """INSERT INTO public.users (email, password_hash) 
                   VALUES (%s, %s) 
                   RETURNING user_id, email, created_at""",
                (user_data.email, password_hash)
            )
            row = cursor.fetchone()
            conn.commit()
            
            return UserResponse(
                user_id=str(row[0]),
                email=row[1],
                created_at=str(row[2])
            )
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")
    finally:
        conn.close()


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, user_data: UserLogin):
    """Authenticates a user and returns a JWT token."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT user_id, password_hash FROM public.users WHERE email = %s",
                (user_data.email,)
            )
            row = cursor.fetchone()

            if not row or not verify_password(user_data.password, row[1]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect email or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Create JWT with user_id as subject
            access_token = create_access_token(data={"sub": str(row[0])})
            return Token(access_token=access_token)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")
    finally:
        conn.close()


@router.get("/profile", response_model=UserProfile)
def get_profile(user_id: str = Depends(get_current_user)):
    """Fetches the current user's profile."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT user_id, email, full_name, garmin_connected, garmin_email, google_calendar_id 
                   FROM public.users WHERE user_id = %s""",
                (user_id,)
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="User not found")
            
            return UserProfile(
                user_id=str(row[0]),
                email=row[1],
                full_name=row[2],
                garmin_connected=row[3] or False,
                garmin_email=row[4],
                google_calendar_id=row[5]
            )
    finally:
        conn.close()


@router.patch("/profile", response_model=UserProfile)
def update_profile(user_update: UserUpdate, user_id: str = Depends(get_current_user)):
    """Updates the current user's profile."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        with conn.cursor() as cursor:
            if user_update.full_name is not None:
                cursor.execute(
                    "UPDATE public.users SET full_name = %s WHERE user_id = %s",
                    (user_update.full_name, user_id)
                )
            if user_update.google_calendar_id is not None:
                cursor.execute(
                    "UPDATE public.users SET google_calendar_id = %s WHERE user_id = %s",
                    (user_update.google_calendar_id, user_id)
                )
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

    return get_profile(user_id)


@router.post("/change-password")
def change_password(data: PasswordChange, user_id: str = Depends(get_current_user)):
    """Changes the current user's password."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT password_hash FROM public.users WHERE user_id = %s", (user_id,))
            row = cursor.fetchone()
            if not row or not verify_password(data.current_password, row[0]):
                raise HTTPException(status_code=401, detail="Contraseña actual incorrecta")
            
            new_hash = get_password_hash(data.new_password)
            cursor.execute("UPDATE public.users SET password_hash = %s WHERE user_id = %s", (new_hash, user_id))
            conn.commit()
            
        return {"status": "ok", "message": "Contraseña actualizada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
