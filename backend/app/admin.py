"""FR10: quản trị viên gỡ/khôi phục tin đăng, khoá/mở khoá tài khoản. FR7: xử lý báo cáo vi phạm.

Tin đăng hiện ngay khi đăng (không chờ duyệt — quyết định 2026-10-02), admin gỡ tin vi phạm sau.
"""
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, joinedload

from app.auth import Role, require_role
from app.db import get_db
from app.jobs import JobOut
from app.models import Job, Report, User
from app.notifications import notify

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
    reason: str | None = Field(None, max_length=500)  # lý do gỡ, gửi kèm thông báo cho người đăng (FR9)


class BlockIn(BaseModel):
    is_blocked: bool


class AdminReportOut(BaseModel):
    id: uuid.UUID
    reason: str
    status: str
    created_at: datetime
    resolved_at: datetime | None
    reporter: AdminUserOut
    reported: AdminUserOut

    model_config = {"from_attributes": True}


class ReportDecisionIn(BaseModel):
    decision: Literal["block", "dismiss"]


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
    if body.status == "rejected":
        reason = (body.reason or "").strip()
        notify(db, job.employer_id, "job_status",
               f"Tin “{job.title}” đã bị quản trị viên gỡ" + (f". Lý do: {reason}" if reason else ""), job.id)
    else:
        notify(db, job.employer_id, "job_status", f"Tin “{job.title}” đã được khôi phục", job.id)
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


# ---------- Báo cáo vi phạm (FR7) ----------


@router.get("/reports", response_model=list[AdminReportOut])
def list_reports(db: Session = Depends(get_db)):
    query = select(Report).order_by(Report.created_at.desc())
    return db.scalars(query.limit(200)).all()  # ponytail: lọc trạng thái ở frontend như /admin/jobs, phân trang khi >200


@router.patch("/reports/{report_id}", response_model=AdminReportOut)
def decide_report(report_id: uuid.UUID, body: ReportDecisionIn, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy báo cáo")
    reported = report.reported
    block = body.decision == "block"
    if block and reported.role == Role.ADMIN:  # tài khoản được nâng quyền admin sau khi bị báo cáo
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Không thể khoá tài khoản quản trị viên")
    # UPDATE có điều kiện: 2 admin cùng xử lý 1 báo cáo thì chỉ 1 người thắng
    result = db.execute(
        update(Report)
        .where(Report.id == report_id, Report.status == "pending")
        .values(status="resolved" if block else "dismissed", resolved_at=func.now())
    )
    if result.rowcount == 0:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Báo cáo đã được xử lý")

    closed = [report]
    if block:
        reported.is_blocked = True
        # Đã khoá thì các báo cáo đang chờ khác về cùng người cũng xong, người báo cáo đều được báo kết quả
        others = db.scalars(
            select(Report).where(Report.reported_id == reported.id, Report.status == "pending", Report.id != report.id)
        ).all()
        for other in others:
            other.status, other.resolved_at = "resolved", func.now()
        closed += others
    outcome = "tài khoản này đã bị khoá" if block else "chưa đủ căn cứ để khoá tài khoản"
    for r in closed:
        notify(db, r.reporter_id, "report_resolved", f"Báo cáo của bạn về {reported.email} đã được xử lý: {outcome}", r.id)
    db.commit()
    db.refresh(report)
    return report
