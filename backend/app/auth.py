import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from enum import StrEnum
from typing import Literal

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import config
from app.config import JWT_REFRESH_SECRET, JWT_SECRET, VERIFICATION_CODE_MINUTES
from app.db import get_db
from app.models import User
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_secret,
    limiter,
    verify_secret,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=True)


class Role(StrEnum):
    JOB_SEEKER = "job_seeker"
    EMPLOYER = "employer"
    ADMIN = "admin"


class RegisterIn(BaseModel):
    email: EmailStr
    # bcrypt cắt cụt input quá 72 byte — chặn ở boundary thay vì để hash sai âm thầm
    password: str = Field(min_length=8, max_length=72)
    # Không cho tự đăng ký admin qua API công khai — admin tạo thẳng trong DB
    role: Literal[Role.JOB_SEEKER, Role.EMPLOYER]
    phone: str | None = Field(default=None, max_length=20)


class VerifyIn(BaseModel):
    user_id: uuid.UUID
    code: str


class ResendIn(BaseModel):
    user_id: uuid.UUID


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    email: EmailStr
    code: str = Field(max_length=6)
    new_password: str = Field(min_length=8, max_length=72)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=72)


class RefreshIn(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    role: Role
    email_verified: bool
    phone_verified: bool
    description: str | None

    model_config = {"from_attributes": True}


class ProfileIn(BaseModel):
    description: str = Field(max_length=2000)


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


def send_verification_code(email: str, code: str, purpose: str = "xác minh email") -> None:
    """FR8: gửi mã qua Brevo. Chưa cấu hình key (dev/test) thì ghi log như tuần 1-5.
    Gửi lỗi không làm hỏng đăng ký: tài khoản đã tạo, chưa xác minh vẫn dùng được đầy đủ."""
    if not config.BREVO_API_KEY:
        log.info("Verification code for %s: %s", email, code)
        return
    try:
        httpx.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": config.BREVO_API_KEY},
            json={
                "sender": {"name": "TimViecPartTime", "email": config.MAIL_FROM},
                "to": [{"email": email}],
                "subject": f"Mã xác minh TimViecPartTime: {code}",
                "textContent": f"Mã {purpose} của bạn là {code}. "
                f"Mã có hiệu lực {VERIFICATION_CODE_MINUTES} phút.",
            },
            timeout=10,
        ).raise_for_status()
    except httpx.HTTPError as e:
        log.warning("Gửi mã xác minh tới %s thất bại: %r", email, e)


def issue_code(user: User) -> str:
    """Sinh mã mới đè lên mã cũ (mã cũ hết hiệu lực), trả mã gốc để gửi đi."""
    code = f"{secrets.randbelow(10**6):06d}"
    user.verification_code = hash_secret(code)
    user.verification_code_expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=VERIFICATION_CODE_MINUTES
    )
    return code


def code_on_cooldown(user: User) -> bool:
    """Mã trước được gửi chưa tới 60s (rate limit theo IP không chặn được spam 1 hộp thư)."""
    expires_at = user.verification_code_expires_at
    return bool(expires_at) and expires_at > datetime.now(timezone.utc) + timedelta(
        minutes=VERIFICATION_CODE_MINUTES - 1
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_token(credentials.credentials, JWT_SECRET, "access")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token không hợp lệ hoặc đã hết hạn")

    user = db.get(User, uuid.UUID(payload["sub"]))
    if user is None or user.is_blocked:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Tài khoản không tồn tại hoặc bị khóa")
    return user


def require_role(*roles: Role):
    """Dependency factory cho RBAC per-route, vd `Depends(require_role(Role.EMPLOYER))`."""

    def check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Không có quyền truy cập")
        return user

    return check


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, body: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email đã được đăng ký")

    user = User(
        email=body.email,
        role=body.role,
        phone=body.phone,
        password_hash=hash_secret(body.password),
    )
    code = issue_code(user)
    db.add(user)
    db.commit()
    db.refresh(user)

    send_verification_code(user.email, code)
    return user


@router.post("/verify", response_model=UserOut)
def verify(body: VerifyIn, db: Session = Depends(get_db)):
    user = db.get(User, body.user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy tài khoản")

    expires_at = user.verification_code_expires_at
    if not user.verification_code or expires_at is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Chưa có mã xác minh nào đang chờ")
    if expires_at < datetime.now(timezone.utc) or not verify_secret(body.code, user.verification_code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mã xác minh sai hoặc đã hết hạn")

    user.email_verified = True
    user.verification_code = None
    user.verification_code_expires_at = None
    db.commit()
    db.refresh(user)
    return user


@router.post("/resend-code", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/minute")
def resend_code(request: Request, body: ResendIn, db: Session = Depends(get_db)):
    user = db.get(User, body.user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy tài khoản")
    if user.email_verified:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email đã được xác minh")
    if code_on_cooldown(user):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Vui lòng đợi 1 phút rồi gửi lại mã")

    code = issue_code(user)
    db.commit()
    send_verification_code(user.email, code)


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/minute")
def forgot_password(request: Request, body: ForgotIn, db: Session = Depends(get_db)):
    """Luôn trả 204 dù email có tồn tại hay không, để không dò được email nào đã đăng ký."""
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None or code_on_cooldown(user):
        return
    code = issue_code(user)
    db.commit()
    send_verification_code(user.email, code, "đặt lại mật khẩu")


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
def reset_password(request: Request, body: ResetIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))
    if (
        user is None
        or not user.verification_code
        or user.verification_code_expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mã sai hoặc đã hết hạn, vui lòng gửi lại mã")
    if not verify_secret(body.code, user.verification_code):
        # Sai 1 lần là huỷ mã; giữ expires_at để cooldown 60s vẫn chặn xin mã mới,
        # nên dò mã 6 số chỉ được 1 lần/phút/tài khoản dù đổi bao nhiêu IP
        user.verification_code = None
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mã sai hoặc đã hết hạn, vui lòng gửi lại mã")

    user.password_hash = hash_secret(body.new_password)
    user.email_verified = True  # nhận được mã qua email = đã chứng minh sở hữu email
    user.verification_code = None
    user.verification_code_expires_at = None
    db.commit()


@router.post("/login", response_model=TokenOut)
@limiter.limit("5/minute")
def login(request: Request, body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None or not verify_secret(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email hoặc mật khẩu không đúng")
    if user.is_blocked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tài khoản đã bị khóa")

    # email_verified=false không chặn đăng nhập (docs/design/sequence-diagram.md mục 1)
    return TokenOut(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token, JWT_REFRESH_SECRET, "refresh")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token không hợp lệ hoặc hết hạn")

    user = db.get(User, uuid.UUID(payload["sub"]))
    if user is None or user.is_blocked:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Tài khoản không tồn tại hoặc bị khóa")

    return TokenOut(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_profile(
    body: ProfileIn, user: User = Depends(require_role(Role.JOB_SEEKER)), db: Session = Depends(get_db)
):
    """Mô tả tự do của job seeker — đầu vào của semantic_score."""
    user.description = body.description
    db.commit()
    db.refresh(user)
    return user
