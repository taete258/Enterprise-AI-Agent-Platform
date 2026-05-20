from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import jwt, JWTError
from cryptography.fernet import Fernet
from .config import get_settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_settings = get_settings()


def hash_password(p: str) -> str:
    return _pwd.hash(p)


def verify_password(p: str, hashed: str) -> bool:
    return _pwd.verify(p, hashed)


def create_access_token(subject: str, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=_settings.jwt_expire_minutes),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, _settings.jwt_secret, algorithm=_settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, _settings.jwt_secret, algorithms=[_settings.jwt_algorithm])
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")


def _fernet() -> Fernet:
    key = _settings.encryption_key
    if not key:
        raise RuntimeError("ENCRYPTION_KEY not set — generate with Fernet.generate_key()")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_secret(plain: str) -> str:
    if not plain:
        return ""
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_secret(token: str) -> str:
    if not token:
        return ""
    return _fernet().decrypt(token.encode()).decode()
