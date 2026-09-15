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
- **Docker Compose chứa các service có state/runtime phụ thuộc: `db` + `backend` (+ `ai-service` từ tuần 4).** Frontend **không** nằm trong compose — chạy Vite dev server ở local, build ra static asset khi deploy. Lý do: SPA không cần container để chạy, đóng container chỉ làm HMR chậm trên Windows bind mount và thêm một tầng config không đổi lại được gì; production cũng phục vụ static build qua CDN/static host chứ không qua Node container.
- Compose khóa `name: timviec` — thư mục này trùng basename với một bản dự án khác trên máy, không khóa tên thì hai bản ghi đè container của nhau.

## API contract Backend ↔ AI Service
- Backend gửi: user hiện tại (lịch rảnh dạng interval, vị trí) + danh sách job ứng viên (đã lọc geo/khu vực trước).
- AI service trả: danh sách job đã xếp hạng, **kèm breakdown từng thành phần điểm** (semantic/time/geo/trust) — không được trả duy nhất 1 số `final_score`. Đây là yêu cầu bắt buộc để UI hiển thị explainable AI.
- Toàn bộ API (cả backend chính và AI service) viết theo OpenAPI/Swagger spec, xác định trước khi code.

## Fallback khi AI service down
Backend phải có fallback (dùng geo/content-based cơ bản) khi AI service không phản hồi — không được để luồng tìm/ứng tuyển job phụ thuộc cứng vào AI service.

## Nguồn tham khảo
Chi tiết đầy đủ: `docs/PROJECT_PLAN.md` mục 4 (Architecture).
