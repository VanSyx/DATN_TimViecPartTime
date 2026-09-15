import os

# Phải set trước khi import app.config (module đọc env ngay lúc import)
os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@localhost:5433/timviec")
os.environ.setdefault("JWT_SECRET", "test-secret-at-least-32-bytes-long-for-hs256")
os.environ.setdefault("JWT_REFRESH_SECRET", "test-refresh-secret-at-least-32-bytes-long-hs256")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db import Base, engine, get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    Base.metadata.create_all(engine)


@pytest.fixture
def db():
    """Mỗi test chạy trong 1 transaction rồi rollback — không để lại dữ liệu trong DB dev.

    join_transaction_mode="create_savepoint" để db.commit() trong endpoint chỉ release
    savepoint, transaction ngoài vẫn rollback được.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def codes(monkeypatch):
    """Bắt mã xác minh mà send_verification_code() lẽ ra gửi đi."""
    captured = []
    monkeypatch.setattr("app.auth.send_verification_code", lambda email, code: captured.append(code))
    return captured
