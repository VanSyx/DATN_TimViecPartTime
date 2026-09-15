import os


def _normalize_db_url(url: str) -> str:
    # Render cấp DATABASE_URL dạng postgres:// hoặc postgresql://; SQLAlchemy mặc định
    # route sang psycopg2, trong khi repo dùng psycopg3 → ép driver về psycopg.
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


DATABASE_URL = _normalize_db_url(os.environ["DATABASE_URL"])
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_REFRESH_SECRET = os.environ["JWT_REFRESH_SECRET"]
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

ACCESS_TOKEN_MINUTES = 15
REFRESH_TOKEN_DAYS = 7
VERIFICATION_CODE_MINUTES = 15
