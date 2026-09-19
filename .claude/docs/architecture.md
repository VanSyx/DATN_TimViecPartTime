# Architecture

## System shape
```
Frontend (React SPA) ──► Backend chính (FastAPI) ──► AI Service (FastAPI, riêng)
                                  │                          │
                                  └──────► PostgreSQL ◄──────┘
                                    (PostGIS + pgvector)
```

- **Monorepo**: 1 repo chứa `frontend/`, `backend/`, `ai-service/`, `docs/`.
- **AI service tách riêng khỏi backend chính** — lý do: cô lập model (TF-IDF nay, embedding sau) để không làm nặng backend, và cho phép nâng cấp AI (tuần 6+: TF-IDF → sentence-transformers + pgvector) mà không đụng vào luồng nghiệp vụ chính.
- Backend chính giữ toàn bộ business logic (auth, RBAC, job CRUD, applications). AI service **chỉ tính điểm**, không giữ state nghiệp vụ.
- **Docker Compose chứa các service có state/runtime phụ thuộc: `db` + `backend` + `ai-service` (cổng 8001, backend gọi qua `AI_SERVICE_URL=http://ai-service:8001`).** Frontend **không** nằm trong compose — chạy Vite dev server ở local, build ra static asset khi deploy. Lý do: SPA không cần container để chạy, đóng container chỉ làm HMR chậm trên Windows bind mount và thêm một tầng config không đổi lại được gì; production cũng phục vụ static build qua CDN/static host chứ không qua Node container.
- Compose khóa `name: timviec` — thư mục này trùng basename với một bản dự án khác trên máy, không khóa tên thì hai bản ghi đè container của nhau.

## API contract Backend ↔ AI Service
- Backend gửi: user hiện tại (lịch rảnh dạng interval, vị trí) + danh sách job ứng viên (đã lọc geo/khu vực trước).
- AI service trả: danh sách job đã xếp hạng, **kèm breakdown từng thành phần điểm** (semantic/time/geo/trust) — không được trả duy nhất 1 số `final_score`. Đây là yêu cầu bắt buộc để UI hiển thị explainable AI.
- Toàn bộ API (cả backend chính và AI service) viết theo OpenAPI/Swagger spec, xác định trước khi code. Spec AI service: `http://localhost:8001/docs`.

Contract đã chốt (tuần 4, `ai-service/app/main.py`):
```
POST /score
{ "seeker": { "description": str, "lat", "lng", "availability": [{ "start", "end" }] },
  "jobs":   [{ "id": str, "title", "description", "lat", "lng", "time": { "start", "end" } }],
  "radius_km": 10 }
→ 200 [{ "job_id", "final_score",
         "breakdown": { "semantic", "time_feasibility", "geo", "trust" },
         "distance_km", "travel_minutes" }]          // đã sắp final_score giảm dần
```
Thời gian là ISO 8601 có timezone (thiếu timezone → 422). Tối đa 500 job/request. Nhãn `source: "ai" | "fallback"` do **backend** gắn (tuần 5), vì chỉ backend biết mình có phải chạy fallback hay không.

## Fallback khi AI service down
Backend phải có fallback (dùng geo/content-based cơ bản) khi AI service không phản hồi — không được để luồng tìm/ứng tuyển job phụ thuộc cứng vào AI service.

## Nguồn tham khảo
Chi tiết đầy đủ: `docs/PROJECT_PLAN.md` mục 4 (Architecture).
