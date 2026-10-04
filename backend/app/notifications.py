"""FR9: thông báo in-app.

notify() chỉ db.add — thông báo được commit cùng transaction với sự kiện sinh ra nó (ứng tuyển, duyệt đơn,
gỡ tin, xử lý báo cáo), sự kiện rollback thì thông báo cũng không còn.
"""
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Notification, User

router = APIRouter(prefix="/notifications", tags=["notifications"])

# new_application: employer có đơn mới · application_status: seeker được nhận/từ chối
# job_status: employer bị gỡ/khôi phục tin · report_resolved: người báo cáo biết kết quả
NotificationType = Literal["new_application", "application_status", "job_status", "report_resolved"]


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: NotificationType
    message: str
    related_id: uuid.UUID | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


def notify(db: Session, user_id: uuid.UUID, type: NotificationType, message: str, related_id: uuid.UUID | None = None):
    db.add(Notification(user_id=user_id, type=type, message=message, related_id=related_id))


@router.get("", response_model=list[NotificationOut])
def my_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc())
    return db.scalars(query.limit(50)).all()  # ponytail: 50 cái mới nhất, phân trang khi cần xem lịch sử dài


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Mở chuông thông báo = đã xem hết."""
    db.execute(update(Notification).where(Notification.user_id == user.id, ~Notification.is_read).values(is_read=True))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
