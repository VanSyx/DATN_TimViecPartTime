import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import (
    ACCESS_TOKEN_MINUTES,
    JWT_REFRESH_SECRET,
    JWT_SECRET,
    REFRESH_TOKEN_DAYS,
)

ALGORITHM = "HS256"


def hash_secret(value: str) -> str:
    return bcrypt.hashpw(value.encode(), bcrypt.gensalt()).decode()


def verify_secret(value: str, hashed: str) -> bool:
    return bcrypt.checkpw(value.encode(), hashed.encode())


def _create_token(subject: str, secret: str, token_type: str, expires: timedelta, **claims) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": subject, "type": token_type, "iat": now, "exp": now + expires, **claims}
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    return _create_token(
        str(user_id), JWT_SECRET, "access", timedelta(minutes=ACCESS_TOKEN_MINUTES), role=role
    )


def create_refresh_token(user_id: uuid.UUID) -> str:
    # ponytail: refresh token stateless, chưa lưu DB nên không thu hồi được trước hạn.
    # Thêm bảng refresh_tokens khi có nhu cầu "đăng xuất mọi thiết bị" (ngoài scope tuần 1-5).
    return _create_token(
        str(user_id), JWT_REFRESH_SECRET, "refresh", timedelta(days=REFRESH_TOKEN_DAYS)
    )


def decode_token(token: str, secret: str, expected_type: str) -> dict:
    """Giải mã token, raise jwt.InvalidTokenError nếu hỏng/hết hạn/sai loại."""
    payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"expected {expected_type} token")
    return payload
