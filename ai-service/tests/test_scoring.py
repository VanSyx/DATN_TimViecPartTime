import unicodedata
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app import scoring
from app.main import app

T0 = datetime(2026, 9, 21, 8, tzinfo=timezone.utc)


def h(hours: float) -> datetime:
    return T0 + timedelta(hours=hours)


# ---------- Haversine ----------

def test_haversine_one_degree_latitude():
    assert scoring.haversine_km(0, 0, 1, 0) == pytest.approx(111.195, abs=0.01)


def test_haversine_hanoi_to_saigon():
    # Hồ Hoàn Kiếm → chợ Bến Thành, đường chim bay ~1.140 km
    assert scoring.haversine_km(21.0288, 105.8525, 10.7725, 106.6980) == pytest.approx(1140, rel=0.01)


def test_haversine_same_point_is_zero():
    assert scoring.haversine_km(16.05, 108.2, 16.05, 108.2) == 0


# ---------- Interval overlap / time feasibility ----------

def test_merge_overlapping_and_touching_intervals():
    merged = scoring.merge_intervals([(h(3), h(5)), (h(0), h(2)), (h(1), h(3)), (h(7), h(8))])
    assert merged == [(h(0), h(5)), (h(7), h(8))]


def test_fully_free_including_travel():
    assert scoring.time_feasibility([(h(0), h(10))], (h(2), h(4)), travel_minutes=30) == 1


def test_not_free_at_all():
    assert scoring.time_feasibility([(h(6), h(8))], (h(2), h(4)), travel_minutes=0) == 0


def test_travel_time_reduces_feasibility():
    # Rảnh đúng khung job 2h, nhưng cần thêm 30' đi + 30' về → 2/3 khung cần thiết
    assert scoring.time_feasibility([(h(2), h(4))], (h(2), h(4)), travel_minutes=30) == pytest.approx(2 / 3)


def test_overlapping_availability_not_double_counted():
    availability = [(h(2), h(4)), (h(2), h(4)), (h(3), h(4))]
    assert scoring.time_feasibility(availability, (h(2), h(4)), travel_minutes=0) == 1


def test_split_availability_sums_coverage():
    # Rảnh 2-3h và 3.5-4h trong job 2-4h → 1.5/2
    availability = [(h(2), h(3)), (h(3.5), h(4))]
    assert scoring.time_feasibility(availability, (h(2), h(4)), travel_minutes=0) == pytest.approx(0.75)


# ---------- Geo ----------

@pytest.mark.parametrize("distance,expected", [(0, 1), (5, 0.5), (10, 0), (25, 0)])
def test_geo_score_linear_within_radius(distance, expected):
    assert scoring.geo_score(distance, radius_km=10) == pytest.approx(expected)


# ---------- TF-IDF semantic ----------

def test_semantic_relevant_job_ranks_higher():
    scores = scoring.semantic_scores(
        "tôi muốn dọn dẹp nhà cửa, lau nhà",
        ["Dọn dẹp căn hộ, lau nhà, rửa bát", "Trông trẻ buổi tối, đón bé đi học"],
    )
    assert scores[0] > scores[1]
    assert all(0 <= s <= 1 for s in scores)


def test_semantic_identical_text_is_one_and_disjoint_is_zero():
    assert scoring.semantic_scores("nấu ăn", ["nấu ăn", "giặt ủi"]) == [pytest.approx(1), 0]


def test_semantic_empty_description_scores_zero():
    assert scoring.semantic_scores("", ["dọn nhà"]) == [0]


def test_semantic_ignores_unicode_composition():
    decomposed = unicodedata.normalize("NFD", "dọn dẹp")
    assert scoring.semantic_scores(decomposed, ["dọn dẹp", "trông trẻ"])[0] == pytest.approx(1)


# ---------- POST /score ----------

client = TestClient(app)
HOAN_KIEM = (21.0288, 105.8525)


def job(id, title, lat, lng, start, end):
    return {"id": id, "title": title, "description": "", "lat": lat, "lng": lng,
            "time": {"start": start.isoformat(), "end": end.isoformat()}}


def test_score_ranks_and_returns_breakdown():
    body = {
        "seeker": {
            "description": "dọn dẹp nhà",
            "lat": HOAN_KIEM[0], "lng": HOAN_KIEM[1],
            "availability": [{"start": h(0).isoformat(), "end": h(10).isoformat()}],
        },
        "jobs": [
            job("far-mismatch", "Trông trẻ", 21.07, 105.82, h(2), h(4)),
            job("near-match", "Dọn dẹp nhà", 21.03, 105.853, h(2), h(4)),
        ],
        "radius_km": 10,
    }
    r = client.post("/score", json=body)
    assert r.status_code == 200
    first, second = r.json()
    assert first["job_id"] == "near-match"
    assert set(first["breakdown"]) == {"semantic", "time_feasibility", "geo", "trust"}
    assert first["breakdown"]["time_feasibility"] == 1
    assert first["breakdown"]["trust"] == 1
    assert first["final_score"] > second["final_score"]
    assert first["distance_km"] < 1 and first["travel_minutes"] < 3


def test_score_rejects_inverted_time_range():
    body = {"seeker": {"lat": 0, "lng": 0},
            "jobs": [job("x", "a", 0, 0, h(4), h(2))]}
    assert client.post("/score", json=body).status_code == 422


def test_score_empty_jobs():
    assert client.post("/score", json={"seeker": {"lat": 0, "lng": 0}, "jobs": []}).json() == []
