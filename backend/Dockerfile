FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Chạy migration trước khi phục vụ: Render free tier không có preDeployCommand,
# và alembic upgrade là idempotent nên an toàn khi container khởi động lại.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
