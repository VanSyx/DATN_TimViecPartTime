"""FR10: quản trị viên gỡ/khôi phục tin đăng, khoá/mở khoá tài khoản.

Tin đăng hiện ngay khi đăng (không chờ duyệt — quyết định 2026-10-02), admin gỡ tin vi phạm sau.
"""
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.orm import Session, joinedload

from app.auth import Role, require_role
from app.db import get_db
from app.jobs import JobOut
from app.models import Job, User

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role(Role.ADMIN))])


class AdminUserOut(BaseModel):
    id: uuid.UUID
    email: str
    phone: str | None
    role: Role
    email_verified: bool
    is_blocked: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminJobOut(JobOut):
    employer: AdminUserOut


class JobStatusIn(BaseModel):
    status: Literal["rejected", "open"]


class BlockIn(BaseModel):
    is_blocked: bool


# Trạng thái đích → trạng thái nguồn duy nhất được phép. Gỡ: chỉ tin đang mở.
# Khôi phục: chỉ tin admin đã gỡ — không mở lại tin employer tự đóng.
JOB_TRANSITIONS = {"rejected": "open", "open": "rejected"}


@router.get("/jobs", response_model=list[AdminJobOut])
def list_jobs(db: Session = Depends(get_db)):
    query = select(Job).options(joinedload(Job.employer)).order_by(Job.created_at.desc())
    return db.scalars(query.limit(200)).all()  # ponytail: chưa phân trang, thêm khi >200 tin


@router.patch("/jobs/{job_id}", response_model=AdminJobOut)
def set_job_status(job_id: uuid.UUID, body: JobStatusIn, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy tin tuyển dụng")
    # UPDATE có điều kiện: employer đóng tin cùng lúc admin gỡ thì chỉ 1 bên thắng
    result = db.execute(
        update(Job).where(Job.id == job_id, Job.status == JOB_TRANSITIONS[body.status]).values(status=body.status)
    )
    if result.rowcount == 0:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Tin không ở trạng thái cho phép thao tác này")
    db.commit()
    db.refresh(job)
    return job


@router.get("/users", response_model=list[AdminUserOut])
def list_users(q: str = Query("", max_length=255), db: Session = Depends(get_db)):
    query = select(User).order_by(User.created_at.desc())
    if q:
        query = query.where(User.email.ilike(f"%{q}%"))
    return db.scalars(query.limit(200)).all()  # ponytail: chưa phân trang, tìm theo email là đủ


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def set_blocked(user_id: uuid.UUID, body: BlockIn, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy tài khoản")
    # Admin không khoá admin (kể cả chính mình): tránh tự khoá mất quyền quản trị
    if user.role == Role.ADMIN:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Không thể khoá tài khoản quản trị viên")
    # Có hiệu lực ngay: get_current_user kiểm is_blocked ở mỗi request, cả access token còn hạn
    user.is_blocked = body.is_blocked
    db.commit()
    db.refresh(user)
    return user
