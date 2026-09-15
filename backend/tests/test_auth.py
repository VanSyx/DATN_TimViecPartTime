import uuid

import pytest
from fastapi import HTTPException

from app.auth import Role, require_role
from app.models import User
from app.security import hash_secret


def register(client, email="js@example.com", password="secret123", role="job_seeker"):
    return client.post(
        "/auth/register", json={"email": email, "password": password, "role": role}
    )


def test_register_creates_unverified_user(client, codes):
    res = register(client)
    assert res.status_code == 201
    body = res.json()
    assert body["email"] == "js@example.com"
    assert body["role"] == "job_seeker"
    assert body["email_verified"] is False
    assert "password_hash" not in body
    assert len(codes) == 1 and len(codes[0]) == 6


def test_register_as_admin_rejected(client, codes):
    assert register(client, role="admin").status_code == 422


def test_register_duplicate_email_rejected(client, codes):
    register(client)
    assert register(client).status_code == 409


def test_verify_with_correct_code(client, codes):
    user_id = register(client).json()["id"]
    res = client.post("/auth/verify", json={"user_id": user_id, "code": codes[0]})
    assert res.status_code == 200
    assert res.json()["email_verified"] is True


def test_verify_with_wrong_code_rejected(client, codes):
    user_id = register(client).json()["id"]
    res = client.post("/auth/verify", json={"user_id": user_id, "code": "000000"})
    assert res.status_code == 400


def test_login_returns_tokens_and_me_works(client, codes):
    register(client)
    res = client.post("/auth/login", json={"email": "js@example.com", "password": "secret123"})
    assert res.status_code == 200
    tokens = res.json()

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "js@example.com"


@pytest.mark.parametrize(
    "payload,expected",
    [
        ({"email": "js@example.com", "password": "wrong-password"}, 401),
        ({"email": "nobody@example.com", "password": "secret123"}, 401),
    ],
)
def test_login_rejects_bad_credentials(client, codes, payload, expected):
    register(client)
    assert client.post("/auth/login", json=payload).status_code == expected


def test_login_rejects_blocked_user(client, db):
    db.add(
        User(
            id=uuid.uuid4(),
            email="blocked@example.com",
            role="job_seeker",
            password_hash=hash_secret("secret123"),
            is_blocked=True,
        )
    )
    db.commit()
    res = client.post(
        "/auth/login", json={"email": "blocked@example.com", "password": "secret123"}
    )
    assert res.status_code == 403


def test_refresh_issues_new_access_token(client, codes):
    register(client)
    tokens = client.post(
        "/auth/login", json={"email": "js@example.com", "password": "secret123"}
    ).json()

    res = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert res.status_code == 200
    assert client.get(
        "/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"}
    ).status_code == 200


def test_refresh_token_rejected_as_access_token(client, codes):
    register(client)
    tokens = client.post(
        "/auth/login", json={"email": "js@example.com", "password": "secret123"}
    ).json()

    res = client.get("/auth/me", headers={"Authorization": f"Bearer {tokens['refresh_token']}"})
    assert res.status_code == 401


def test_access_token_rejected_as_refresh_token(client, codes):
    register(client)
    tokens = client.post(
        "/auth/login", json={"email": "js@example.com", "password": "secret123"}
    ).json()

    assert client.post(
        "/auth/refresh", json={"refresh_token": tokens["access_token"]}
    ).status_code == 401


def test_require_role_allows_matching_role():
    checker = require_role(Role.EMPLOYER)
    user = User(role="employer")
    assert checker(user=user) is user


def test_require_role_blocks_other_role():
    checker = require_role(Role.EMPLOYER)
    user = User(role="job_seeker")
    with pytest.raises(HTTPException) as exc_info:
        checker(user=user)
    assert exc_info.value.status_code == 403


def test_register_rate_limited_after_5_per_minute(client, codes):
    for i in range(5):
        register(client, email=f"rl{i}@example.com")
    assert register(client, email="rl-over@example.com").status_code == 429


def test_login_rate_limited_after_5_per_minute(client, codes):
    register(client)
    for _ in range(5):
        client.post("/auth/login", json={"email": "js@example.com", "password": "wrong"})
    res = client.post("/auth/login", json={"email": "js@example.com", "password": "secret123"})
    assert res.status_code == 429
