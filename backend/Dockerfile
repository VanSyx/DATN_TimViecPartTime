FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Chạy migration trước khi phục vụ: Render free tier không có preDeployCommand,
# và alembic upgrade là idempotent nên an toàn khi container khởi động lại.
# --proxy-headers: sau proxy của Render, client.host là IP load balancer → rate limit
# (slowapi, theo IP) sẽ gộp mọi user chung 1 bucket nếu không đọc X-Forwarded-For.
# ponytail: tin XFF từ mọi IP ("*") nên client có thể giả header để né rate limit;
# giới hạn allow-ips theo dải IP proxy của Render nếu cần chặn chặt.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
