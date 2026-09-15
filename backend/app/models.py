import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Computed,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import UserDefinedType

from app.db import Base


class Geography(UserDefinedType):
    """Kiểu PostGIS geography(Point) — chỉ dùng trong SQL (ST_DWithin/ST_Distance), không đọc ra Python."""

    cache_ok = True

    def get_col_spec(self, **kw):
        return "geography(Point, 4326)"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    role: Mapped[str] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), default=None)
    password_hash: Mapped[str] = mapped_column(String(255))
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_code: Mapped[str | None] = mapped_column(String(255), default=None)
    verification_code_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint("time_end > time_start", name="ck_jobs_time_range"),
        Index("ix_jobs_location", "location", postgresql_using="gist"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    employer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    # Địa chỉ theo địa giới 2 cấp (từ 1/7/2025): số nhà + đường / phường-xã / tỉnh-thành phố
    street: Mapped[str] = mapped_column(String(200))
    ward: Mapped[str] = mapped_column(String(100))
    city: Mapped[str] = mapped_column(String(100))
    # lat/lng do backend geocode từ địa chỉ (Goong); location do Postgres tự sinh cho GiST index + ST_DWithin
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    location = mapped_column(
        Geography(),
        Computed("ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography", persisted=True),
    )
    time_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    time_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    salary: Mapped[int] = mapped_column(Integer)  # VND
    # pending_approval/rejected dành cho FR10 (tuần 6+); tuần 1-5 đăng là open luôn
    status: Mapped[str] = mapped_column(String(20), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AvailabilityInterval(Base):
    __tablename__ = "availability_intervals"
    __table_args__ = (CheckConstraint("end_time > start_time", name="ck_availability_time_range"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_seeker_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        # Mỗi job seeker chỉ có 1 đơn còn hiệu lực/job; hủy rồi thì được nộp lại
        Index(
            "uq_applications_active",
            "job_id",
            "job_seeker_id",
            unique=True,
            postgresql_where=text("status <> 'cancelled'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id"), index=True)
    job_seeker_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    job: Mapped[Job] = relationship(lazy="joined")
    job_seeker: Mapped[User] = relationship(lazy="joined")
