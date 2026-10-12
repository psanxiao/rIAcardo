"""Symmetric encryption for sensitive fields (e.g. Garmin passwords)."""
import os
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

load_dotenv()

_raw_key = os.getenv("ENCRYPTION_KEY")

if _raw_key:
    _fernet = Fernet(_raw_key.encode() if isinstance(_raw_key, str) else _raw_key)
else:
    # Auto-generate one and warn — dev only
    import secrets as _s
    _key = Fernet.generate_key()
    _fernet = Fernet(_key)
    print(f"[WARNING] ENCRYPTION_KEY not set — generated ephemeral key: {_key.decode()}")


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string, returns a base64 token string."""
    if plaintext is None:
        return None
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    """Decrypt a Fernet token string, returns plaintext. Raises on invalid token."""
    if token is None:
        return None
    return _fernet.decrypt(token.encode()).decode()


def is_encrypted(value: str) -> bool:
    """Heuristic: does this look like a Fernet token?"""
    if not value:
        return False
    try:
        return value.startswith("gAAAAA")
    except Exception:
        return False


def generate_key() -> str:
    """Generate a new Fernet key for .env config."""
    return Fernet.generate_key().decode()