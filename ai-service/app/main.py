from fastapi import FastAPI
from pydantic import AwareDatetime, BaseModel, Field, model_validator

from app import scoring

app = FastAPI(title="TimViecPartTime AI Service")


class TimeRange(BaseModel):
    start: AwareDatetime
    end: AwareDatetime

    @model_validator(mode="after")
    def _check_range(self):
        if self.end <= self.start:
            raise ValueError("end phải sau start")
        return self


class Seeker(BaseModel):
    description: str = Field("", max_length=5000)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    availability: list[TimeRange] = Field(default_factory=list, max_length=500)


class JobIn(BaseModel):
    id: str
    title: str
    description: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    time: TimeRange


class ScoreIn(BaseModel):
    seeker: Seeker
    jobs: list[JobIn] = Field(max_length=500)
    radius_km: float = Field(10, gt=0, le=100)


class Breakdown(BaseModel):
    semantic: float
    time_feasibility: float
    geo: float
    trust: float


class ScoredJob(BaseModel):
    job_id: str
    final_score: float
    breakdown: Breakdown
    distance_km: float
    travel_minutes: float


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/score", response_model=list[ScoredJob])
def score(body: ScoreIn):
    """Xếp hạng job cho 1 người tìm việc, trả breakdown từng thành phần (explainable AI)."""
    s = body.seeker
    availability = [(a.start, a.end) for a in s.availability]
    semantic = scoring.semantic_scores(s.description, [f"{j.title} {j.description}" for j in body.jobs])

    results = []
    for job, sem in zip(body.jobs, semantic):
        distance = scoring.haversine_km(s.lat, s.lng, job.lat, job.lng)
        travel = distance / scoring.TRAVEL_SPEED_KMH * 60
        breakdown = {
            "semantic": sem,
            "time_feasibility": scoring.time_feasibility(availability, (job.time.start, job.time.end), travel),
            "geo": scoring.geo_score(distance, body.radius_km),
            # Chưa có bảng ratings (tuần 6+): trung lập 1.0 cho mọi job nên không làm lệch thứ hạng
            "trust": 1.0,
        }
        results.append(
            ScoredJob(
                job_id=job.id,
                final_score=round(scoring.final_score(breakdown), 4),
                breakdown=Breakdown(**{k: round(v, 4) for k, v in breakdown.items()}),
                distance_km=round(distance, 2),
                travel_minutes=round(travel, 1),
            )
        )
    return sorted(results, key=lambda r: r.final_score, reverse=True)
