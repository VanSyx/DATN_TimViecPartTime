import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import AwareDatetime, BaseModel, Field, model_validator
from sqlalchemy import cast, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import Role, require_role
from app.db import get_db
from app.models import Application, AvailabilityInterval, Geography, Job, User

router = APIRouter()
employer = require_role(Role.EMPLOYER)
job_seeker = require_role(Role.JOB_SEEKER)


class JobIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=1, max_length=5000)
    street: str = Field(min_length=2, max_length=200)
    ward: str = Field(min_length=2, max_length=100)
    city: str = Field(min_length=2, max_length=100)
    # Người dùng ghép ghim trên bản đồ ở frontend (Leaflet/OSM) — không geocode ở backend,
    # tránh phụ thuộc API bên thứ 3 (Goong cần admin duyệt key, Nominatim chặn IP server)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    time_start: AwareDatetime
    time_end: AwareDatetime
    salary: int = Field(ge=0, le=2_000_000_000)

    @model_validator(mode="after")
    def _check_range(self):
        if self.time_end <= self.time_start:
            raise ValueError("time_end phải sau time_start")
        return self


class JobOut(BaseModel):
    id: uuid.UUID
    employer_id: uuid.UUID
    title: str
    description: str
    street: str
    ward: str
    city: str
    lat: float
    lng: float
    time_start: datetime
    time_end: datetime
    salary: int
    status: str
    created_at: datetime
    distance_km: float | None = None

    model_config = {"from_attributes": True}


class AvailabilityIn(BaseModel):
    start_time: AwareDatetime
    end_time: AwareDatetime

    @model_validator(mode="after")
    def _check_range(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time phải sau start_time")
        return self


class AvailabilityOut(BaseModel):
    id: uuid.UUID
    start_time: datetime
    end_time: datetime

    model_config = {"from_attributes": True}


class ApplicationIn(BaseModel):
    job_id: uuid.UUID


class ApplicationStatusIn(BaseModel):
    status: Literal["accepted", "rejected", "cancelled"]


class ApplicantOut(BaseModel):
    id: uuid.UUID
    email: str
    phone: str | None

    model_config = {"from_attributes": True}


class ApplicationOut(BaseModel):
    id: uuid.UUID
    status: str
    created_at: datetime
    updated_at: datetime
    job: JobOut
    job_seeker: ApplicantOut

    model_config = {"from_attributes": True}


def get_own_job(job_id: uuid.UUID, user: User, db: Session) -> Job:
    job = db.get(Job, job_id)
    # 404 thay vì 403: không tiết lộ job của employer khác có tồn tại hay không
    if job is None or job.employer_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy tin tuyển dụng")
    return job


# ---------- Jobs (FR2, FR3) ----------

@router.get("/jobs", response_model=list[JobOut], tags=["jobs"])
def search_jobs(
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    radius_km: float = Query(10, gt=0, le=100),
    start: AwareDatetime | None = None,
    end: AwareDatetime | None = None,
    db: Session = Depends(get_db),
):
    """Tìm/lọc thô job đang mở quanh 1 toạ độ (GPS hoặc điểm chọn trên bản đồ) + khung giờ (không dùng AI)."""
    if (lat is None) != (lng is None):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Cần truyền cả lat và lng")

    query = select(Job).where(Job.status == "open")
    # Khung giờ: giữ job có chồng lấp với [start, end] (docs/design/sequence-diagram.md mục 5)
    if start:
        query = query.where(Job.time_end > start)
    if end:
        query = query.where(Job.time_start < end)

    if lat is None:
        jobs = db.scalars(query.order_by(Job.created_at.desc()).limit(100)).all()
        return jobs

    point = cast(func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326), Geography())
    distance_km = func.ST_Distance(Job.location, point) / 1000
    rows = db.execute(
        query.add_columns(distance_km)
        .where(func.ST_DWithin(Job.location, point, radius_km * 1000))
        .order_by(distance_km)
        .limit(100)  # ponytail: chưa phân trang, thêm offset/cursor khi 1 khu vực có >100 job mở
    ).all()
    for job, dist in rows:
        job.distance_km = round(dist, 2)
    return [job for job, _ in rows]


@router.get("/jobs/mine", response_model=list[JobOut], tags=["jobs"])
def my_jobs(user: User = Depends(employer), db: Session = Depends(get_db)):
    return db.scalars(
        select(Job).where(Job.employer_id == user.id).order_by(Job.created_at.desc())
    ).all()


@router.post("/jobs", response_model=JobOut, status_code=status.HTTP_201_CREATED, tags=["jobs"])
def create_job(body: JobIn, user: User = Depends(employer), db: Session = Depends(get_db)):
    job = Job(**body.model_dump(), employer_id=user.id)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.put("/jobs/{job_id}", response_model=JobOut, tags=["jobs"])
def update_job(
    job_id: uuid.UUID, body: JobIn, user: User = Depends(employer), db: Session = Depends(get_db)
):
    job = get_own_job(job_id, user, db)
    for key, value in body.model_dump().items():
        setattr(job, key, value)
    db.commit()
    db.refresh(job)
    return job


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["jobs"])
def close_job(job_id: uuid.UUID, user: User = Depends(employer), db: Session = Depends(get_db)):
    # Đóng mềm: giữ lại bản ghi vì applications còn tham chiếu tới job
    get_own_job(job_id, user, db).status = "closed"
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/jobs/{job_id}/applications", response_model=list[ApplicationOut], tags=["applications"])
def job_applications(job_id: uuid.UUID, user: User = Depends(employer), db: Session = Depends(get_db)):
    get_own_job(job_id, user, db)
    return db.scalars(
        select(Application).where(Application.job_id == job_id).order_by(Application.created_at)
    ).all()


# ---------- Availability (FR3) ----------

@router.get("/availability", response_model=list[AvailabilityOut], tags=["availability"])
def my_availability(user: User = Depends(job_seeker), db: Session = Depends(get_db)):
    return db.scalars(
        select(AvailabilityInterval)
        .where(AvailabilityInterval.job_seeker_id == user.id)
        .order_by(AvailabilityInterval.start_time)
    ).all()


@router.post(
    "/availability", response_model=AvailabilityOut, status_code=status.HTTP_201_CREATED, tags=["availability"]
)
def add_availability(body: AvailabilityIn, user: User = Depends(job_seeker), db: Session = Depends(get_db)):
    # ponytail: không gộp các interval chồng lấp — AI time_feasibility tính trên hợp các interval là đủ
    interval = AvailabilityInterval(**body.model_dump(), job_seeker_id=user.id)
    db.add(interval)
    db.commit()
    db.refresh(interval)
    return interval


@router.delete("/availability/{interval_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["availability"])
def delete_availability(interval_id: uuid.UUID, user: User = Depends(job_seeker), db: Session = Depends(get_db)):
    interval = db.get(AvailabilityInterval, interval_id)
    if interval is None or interval.job_seeker_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy khoảng thời gian rảnh")
    db.delete(interval)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Applications (FR5) ----------

@router.post(
    "/applications", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED, tags=["applications"]
)
def apply(body: ApplicationIn, user: User = Depends(job_seeker), db: Session = Depends(get_db)):
    job = db.get(Job, body.job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy tin tuyển dụng")
    if job.status != "open":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tin tuyển dụng đã đóng")

    application = Application(job_id=job.id, job_seeker_id=user.id)
    db.add(application)
    try:
        db.commit()
    except IntegrityError:  # uq_applications_active
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Bạn đã ứng tuyển job này")
    db.refresh(application)
    return application


@router.get("/applications/me", response_model=list[ApplicationOut], tags=["applications"])
def my_applications(user: User = Depends(job_seeker), db: Session = Depends(get_db)):
    return db.scalars(
        select(Application)
        .where(Application.job_seeker_id == user.id)
        .order_by(Application.created_at.desc())
    ).all()


# Ai được chuyển đơn sang trạng thái nào; mọi chuyển đổi đều chỉ đi từ pending
ALLOWED_TRANSITIONS = {
    (Role.JOB_SEEKER, "cancelled"),
    (Role.EMPLOYER, "accepted"),
    (Role.EMPLOYER, "rejected"),
}


@router.patch("/applications/{application_id}", response_model=ApplicationOut, tags=["applications"])
def change_application_status(
    application_id: uuid.UUID,
    body: ApplicationStatusIn,
    user: User = Depends(require_role(Role.JOB_SEEKER, Role.EMPLOYER)),
    db: Session = Depends(get_db),
):
    application = db.get(Application, application_id)
    owner_id = None
    if application is not None:
        owner_id = application.job_seeker_id if user.role == Role.JOB_SEEKER else application.job.employer_id
    if owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy đơn ứng tuyển")
    if (user.role, body.status) not in ALLOWED_TRANSITIONS:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Không có quyền chuyển đơn sang trạng thái này")

    # UPDATE có điều kiện: seeker hủy và employer duyệt cùng lúc thì chỉ 1 bên thắng
    result = db.execute(
        update(Application)
        .where(Application.id == application_id, Application.status == "pending")
        .values(status=body.status, updated_at=func.now())
    )
    if result.rowcount == 0:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Đơn không còn ở trạng thái chờ duyệt")
    db.commit()
    db.refresh(application)
    return application
