import pytest

# Hồ Hoàn Kiếm; Hồ Tây cách ~4 km; TP.HCM cách ~1100 km — toạ độ lấy từ điểm ghim trên bản đồ (frontend)
HOAN_KIEM = {"street": "1 Đinh Tiên Hoàng", "ward": "Phường Hoàn Kiếm", "city": "Hà Nội", "lat": 21.0285, "lng": 105.8542}
HO_TAY = {"street": "614 Lạc Long Quân", "ward": "Phường Tây Hồ", "city": "Hà Nội", "lat": 21.0580, "lng": 105.8190}
SAIGON = {"street": "1 Lê Lợi", "ward": "Phường Sài Gòn", "city": "TP. Hồ Chí Minh", "lat": 10.7769, "lng": 106.7009}


def job_payload(loc=HOAN_KIEM, start="2030-01-01T08:00:00+07:00", end="2030-01-01T12:00:00+07:00", **kw):
    return {
        "title": "Dọn dẹp nhà",
        "description": "Dọn dẹp căn hộ 2 phòng ngủ",
        **loc,
        "time_start": start,
        "time_end": end,
        "salary": 200000,
        **kw,
    }


@pytest.fixture
def employer(auth_headers):
    return auth_headers("employer")


@pytest.fixture
def seeker(auth_headers):
    return auth_headers("job_seeker")


def create_job(client, headers, **kw):
    res = client.post("/jobs", json=job_payload(**kw), headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


# ---------- Jobs ----------

def test_employer_creates_job_open(client, employer):
    job = create_job(client, employer)
    assert job["status"] == "open"
    assert client.get("/jobs/mine", headers=employer).json()[0]["id"] == job["id"]


def test_job_seeker_cannot_create_job(client, seeker):
    assert client.post("/jobs", json=job_payload(), headers=seeker).status_code == 403


def test_create_job_requires_login(client):
    assert client.post("/jobs", json=job_payload()).status_code in (401, 403)


def test_job_time_range_validated(client, employer):
    bad = job_payload(start="2030-01-01T12:00:00+07:00", end="2030-01-01T08:00:00+07:00")
    assert client.post("/jobs", json=bad, headers=employer).status_code == 422


def test_other_employer_cannot_edit_or_close(client, employer, auth_headers):
    job = create_job(client, employer)
    other = auth_headers("employer")
    assert client.put(f"/jobs/{job['id']}", json=job_payload(title="Hack"), headers=other).status_code == 404
    assert client.delete(f"/jobs/{job['id']}", headers=other).status_code == 404


def test_owner_edits_and_closes_job(client, employer):
    job = create_job(client, employer)
    res = client.put(f"/jobs/{job['id']}", json=job_payload(title="Nấu ăn"), headers=employer)
    assert res.status_code == 200 and res.json()["title"] == "Nấu ăn"

    assert client.delete(f"/jobs/{job['id']}", headers=employer).status_code == 204
    assert job["id"] not in [j["id"] for j in client.get("/jobs").json()]


def test_job_stores_address_and_pinned_coordinates(client, employer):
    job = create_job(client, employer, loc=HO_TAY)
    assert {k: job[k] for k in HO_TAY} == HO_TAY


def test_geo_search_filters_by_radius_and_sorts_by_distance(client, employer):
    near = create_job(client, employer, loc=HOAN_KIEM)
    mid = create_job(client, employer, loc=HO_TAY)
    far = create_job(client, employer, loc=SAIGON)

    res = client.get("/jobs", params={"lat": HOAN_KIEM["lat"], "lng": HOAN_KIEM["lng"], "radius_km": 10})
    ids = [j["id"] for j in res.json()]
    assert far["id"] not in ids
    assert ids.index(near["id"]) < ids.index(mid["id"])
    by_id = {j["id"]: j for j in res.json()}
    assert by_id[near["id"]]["distance_km"] == 0
    assert 3 < by_id[mid["id"]]["distance_km"] < 6


def test_geo_search_requires_both_lat_and_lng(client):
    assert client.get("/jobs", params={"lat": 21.0}).status_code == 422


def test_time_filter_keeps_overlapping_jobs(client, employer):
    morning = create_job(client, employer, start="2030-01-01T08:00:00+07:00", end="2030-01-01T12:00:00+07:00")
    evening = create_job(client, employer, start="2030-01-01T18:00:00+07:00", end="2030-01-01T21:00:00+07:00")

    res = client.get("/jobs", params={"start": "2030-01-01T11:00:00+07:00", "end": "2030-01-01T14:00:00+07:00"})
    ids = [j["id"] for j in res.json()]
    assert morning["id"] in ids and evening["id"] not in ids


# ---------- Availability ----------

def test_availability_crud_and_ownership(client, seeker, auth_headers):
    body = {"start_time": "2030-01-01T08:00:00+07:00", "end_time": "2030-01-01T12:00:00+07:00"}
    interval = client.post("/availability", json=body, headers=seeker).json()
    assert [i["id"] for i in client.get("/availability", headers=seeker).json()] == [interval["id"]]

    other = auth_headers("job_seeker")
    assert client.delete(f"/availability/{interval['id']}", headers=other).status_code == 404
    assert client.delete(f"/availability/{interval['id']}", headers=seeker).status_code == 204
    assert client.get("/availability", headers=seeker).json() == []


def test_availability_rejects_reversed_range(client, seeker):
    body = {"start_time": "2030-01-01T12:00:00+07:00", "end_time": "2030-01-01T08:00:00+07:00"}
    assert client.post("/availability", json=body, headers=seeker).status_code == 422


def test_seeker_sets_free_text_description(client, seeker):
    r = client.patch("/auth/me", json={"description": "Dọn dẹp, nấu ăn"}, headers=seeker)
    assert r.status_code == 200
    assert client.get("/auth/me", headers=seeker).json()["description"] == "Dọn dẹp, nấu ăn"


def test_employer_cannot_set_seeker_description(client, employer):
    assert client.patch("/auth/me", json={"description": "x"}, headers=employer).status_code == 403


def test_employer_cannot_declare_availability(client, employer):
    assert client.get("/availability", headers=employer).status_code == 403


# ---------- Applications ----------

def apply(client, seeker, job):
    return client.post("/applications", json={"job_id": job["id"]}, headers=seeker)


def set_status(client, headers, application, status):
    return client.patch(f"/applications/{application['id']}", json={"status": status}, headers=headers)


def test_apply_accept_flow(client, employer, seeker):
    job = create_job(client, employer)
    application = apply(client, seeker, job).json()
    assert application["status"] == "pending"
    assert apply(client, seeker, job).status_code == 409

    applicants = client.get(f"/jobs/{job['id']}/applications", headers=employer).json()
    assert [a["id"] for a in applicants] == [application["id"]]

    res = set_status(client, employer, application, "accepted")
    assert res.status_code == 200 and res.json()["status"] == "accepted"
    assert client.get("/applications/me", headers=seeker).json()[0]["status"] == "accepted"

    # Đã duyệt thì không hủy được nữa
    assert set_status(client, seeker, application, "cancelled").status_code == 409


def test_cancel_pending_then_reapply(client, employer, seeker):
    job = create_job(client, employer)
    application = apply(client, seeker, job).json()
    assert set_status(client, seeker, application, "cancelled").json()["status"] == "cancelled"
    assert apply(client, seeker, job).status_code == 201


@pytest.mark.parametrize("role_fixture,status", [("seeker", "accepted"), ("employer", "cancelled")])
def test_role_cannot_make_other_roles_transition(client, employer, seeker, request, role_fixture, status):
    application = apply(client, seeker, create_job(client, employer)).json()
    headers = request.getfixturevalue(role_fixture)
    assert set_status(client, headers, application, status).status_code == 403


def test_other_employer_cannot_touch_application(client, employer, seeker, auth_headers):
    job = create_job(client, employer)
    application = apply(client, seeker, job).json()
    other = auth_headers("employer")
    assert set_status(client, other, application, "accepted").status_code == 404
    assert client.get(f"/jobs/{job['id']}/applications", headers=other).status_code == 404


def test_cannot_apply_to_closed_job(client, employer, seeker):
    job = create_job(client, employer)
    client.delete(f"/jobs/{job['id']}", headers=employer)
    assert apply(client, seeker, job).status_code == 400


PAST = {"start": "2020-01-01T08:00:00+07:00", "end": "2020-01-01T12:00:00+07:00"}


def test_expired_job_hidden_from_search_but_kept_for_employer(client, employer):
    expired = create_job(client, employer, title="Tin quá hạn", **PAST)
    create_job(client, employer, title="Tin còn hạn")
    titles = [j["title"] for j in client.get("/jobs", params={"lat": 21.0285, "lng": 105.8542}).json()]
    assert "Tin còn hạn" in titles and "Tin quá hạn" not in titles
    assert expired["id"] in [j["id"] for j in client.get("/jobs/mine", headers=employer).json()]


def test_cannot_apply_to_expired_job(client, employer, seeker):
    job = create_job(client, employer, **PAST)
    res = apply(client, seeker, job)
    assert res.status_code == 400 and "kết thúc" in res.json()["detail"]
