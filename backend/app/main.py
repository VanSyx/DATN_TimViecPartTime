import logging

from fastapi import FastAPI

from app.auth import router as auth_router

# Uvicorn chỉ cấu hình logger của chính nó; không bật INFO ở root thì log của app bị nuốt
# — mà tuần 1-5 mã xác minh chỉ đọc được qua log (docs/PROJECT_PLAN.md mục 3.1 FR8).
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI(title="TimViecPartTime API")
app.include_router(auth_router)


@app.get("/health")
def health():
    return {"status": "ok"}
