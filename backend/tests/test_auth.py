import uuid
from datetime import timedelta

import httpx
import pytest
from fastapi import HTTPException

from app.auth import Role, require_role
from app.models import User
from app.security import hash_secret, limiter


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


def test_register_sends_code_via_brevo_and_survives_send_failure(client, monkeypatch):
    monkeypatch.setattr("app.config.BREVO_API_KEY", "k")
    monkeypatch.setattr("app.config.MAIL_FROM", "from@example.com")
    sent = []

    def fake_post(url, headers, json, timeout):
        sent.append(json)
        return httpx.Response(201, request=httpx.Request("POST", url))

    monkeypatch.setattr("app.auth.httpx.post", fake_post)
    assert register(client).status_code == 201
    mail = sent[0]
    assert mail["to"] == [{"email": "js@example.com"}] and mail["sender"]["email"] == "from@example.com"
    code = mail["subject"].rsplit(" ", 1)[-1]
    assert len(code) == 6 and code in mail["textContent"]

    def down(*a, **kw):
        raise httpx.ConnectError("down")

    monkeypatch.setattr("app.auth.httpx.post", down)
    assert register(client, email="js2@example.com").status_code == 201


def test_resend_code_replaces_old_code_with_cooldown(client, db, codes):
    user_id = register(client).json()["id"]
    resend = lambda: client.post("/auth/resend-code", json={"user_id": user_id})  # noqa: E731
    assert resend().status_code == 429  # vừa gửi lúc đăng ký

    user = db.get(User, uuid.UUID(user_id))
    user.verification_code_expires_at -= timedelta(seconds=61)
    db.commit()
    assert resend().status_code == 204
    assert len(codes) == 2
    assert client.post("/auth/verify", json={"user_id": user_id, "code": codes[0]}).status_code == 400
    assert client.post("/auth/verify", json={"user_id": user_id, "code": codes[1]}).status_code == 200
    assert resend().status_code == 400  # đã xác minh
    assert resend().status_code == 429  # lần thứ 4 trong 1 phút: chặn theo IP
    limiter.reset()
    assert client.post("/auth/resend-code", json={"user_id": str(uuid.uuid4())}).status_code == 404


def test_forgot_and_reset_password(client, db, codes):
    user_id = register(client).json()["id"]
    forgot = lambda email="js@example.com": client.post("/auth/forgot-password", json={"email": email})  # noqa: E731
    reset = lambda code, pw="newpass123": client.post(  # noqa: E731
        "/auth/reset-password", json={"email": "js@example.com", "code": code, "new_password": pw}
    )
    user = db.get(User, uuid.UUID(user_id))
    user.verification_code_expires_at -= timedelta(seconds=61)
    db.commit()

    assert forgot("nobody@example.com").status_code == 204 and len(codes) == 1  # không lộ email
    assert forgot().status_code == 204 and len(codes) == 2
    assert forgot().status_code == 204 and len(codes) == 2  # cooldown: im lặng, không gửi
    limiter.reset()

    wrong = "000000" if codes[1] != "000000" else "111111"
    assert reset(wrong).status_code == 400
    assert reset(codes[1]).status_code == 400  # sai 1 lần là huỷ mã
    user.verification_code_expires_at -= timedelta(seconds=61)
    db.commit()
    assert forgot().status_code == 204
    assert reset(codes[2], pw="short").status_code == 422
    assert reset(codes[2]).status_code == 204
    assert reset(codes[2]).status_code == 400  # mã dùng 1 lần

    login = lambda pw: client.post("/auth/login", json={"email": "js@example.com", "password": pw})  # noqa: E731
    assert login("secret123").status_code == 401
    assert login("newpass123").status_code == 200
    db.refresh(user)
    assert user.email_verified
