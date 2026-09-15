# Báo cáo tiến độ — Tuần 3 (Job CRUD, Application flow, Geo search)

Branch: `feat/week3-jobs` (tách từ `feat/week2-auth`, chưa merge). Ảnh minh chứng: `docs/screenshots/week3/`.

## Đối chiếu kế hoạch (`PROJECT_PLAN.md` mục 5.1)

| Ngày | Kế hoạch | Kết quả |
|---|---|---|
| 1-2 | Model `jobs`, `availability_intervals`, CRUD job cho Employer | ✅ Đạt |
| 3 | Geo search PostGIS | ✅ Đạt |
| 4 | Model `applications`, luồng ứng tuyển + trạng thái đơn | ✅ Đạt (gồm hủy đơn UC9) |
| 5 | Frontend: đăng tin, danh sách job, filter khu vực/khung giờ, form ứng tuyển | ✅ Đạt |

**Deliverable "Job CRUD + tìm/lọc + ứng tuyển hoạt động đầy đủ trên cả FE/BE": đạt** — đã chạy thử toàn bộ luồng trên UI thật (ảnh 03-11).

## Chi tiết đã làm

**Database** (migration `658771f39e2e`, ảnh 01)
- `jobs`: `lat/lng` + cột `location geography(Point,4326)` do Postgres tự sinh từ lat/lng, có GiST index; CHECK `time_end > time_start`
- `availability_intervals`: interval thời gian thực (timestamptz start/end), CHECK `end > start` — không dùng ca cố định
- `applications`: unique index một phần — mỗi job seeker chỉ có 1 đơn còn hiệu lực/job, hủy rồi được nộp lại

**Backend** (`backend/app/jobs.py`, ảnh 02)
- Jobs (UC11-13): `POST /jobs`, `PUT /jobs/{id}`, `DELETE /jobs/{id}` (đóng mềm → `closed`), `GET /jobs/mine`
- Tìm/lọc (UC5): `GET /jobs?lat&lng&radius_km&start&end` — `ST_DWithin` theo bán kính, sắp theo khoảng cách, trả `distance_km`; lọc job chồng lấp khung giờ
- Lịch rảnh (UC4): `GET/POST /availability`, `DELETE /availability/{id}`
- Ứng tuyển (UC7-10): `POST /applications`, `GET /applications/me`, `GET /jobs/{id}/applications`, `PATCH /applications/{id}`
- Bảo mật: RBAC theo role ở mọi route + kiểm tra ownership (employer B không sửa/đóng/xem đơn job của A → 404); bảng chuyển trạng thái cho phép theo role (seeker chỉ hủy, employer chỉ nhận/từ chối); UPDATE có điều kiện `status = 'pending'` để seeker hủy và employer duyệt cùng lúc thì chỉ 1 bên thắng

**Frontend** (`frontend/src/pages/JobPages.tsx`)
- Job seeker: Tìm việc (lọc vị trí + bán kính + khung giờ, nút "Dùng vị trí hiện tại"), Lịch rảnh, Đơn ứng tuyển (hủy khi đang chờ)
- Employer: đăng/sửa/đóng tin, xem danh sách ứng viên, nhận/từ chối

**Kiểm thử**
- `pytest`: **35/35 pass** (20 test mới trong `tests/test_jobs.py`: RBAC, ownership, geo radius + sắp xếp, lọc khung giờ, luồng đơn, chuyển trạng thái sai role) — ảnh 12
- E2E trên UI thật (Edge headless): employer đăng tin → seeker khai lịch rảnh → tìm theo Hoàn Kiếm bán kính 10 km (có Hồ Tây 4.9 km, loại tin TP.HCM) → ứng tuyển → employer nhận → seeker thấy "Đã nhận"; seeker vào `/employer` bị đẩy về `/seeker`
- `npm run lint` + `npm run build` pass; `alembic check` không lệch models

## Chưa làm / giới hạn đã biết
- **Chưa deploy lên Render** — cần merge (Tuần 2 + 3) để Render build; lần deploy này sẽ chạy migration bật PostGIS trên Postgres managed, cần kiểm tra thủ công sau deploy.
- Nhập vị trí bằng lat/lng hoặc GPS trình duyệt; chưa có chọn trên bản đồ / nhập địa chỉ (cần API geocoding ngoài — xác nhận trước nếu muốn thêm).
- "Mô tả tự do" của job seeker (Scope 2.1) chưa có — cần cho `semantic_score`, làm đầu Tuần 4.
- Chưa phân trang (tối đa 100 kết quả/lần tìm); không gộp các interval rảnh chồng nhau.
- Trạng thái `completed` (sau khi làm xong việc) chưa có transition — thuộc luồng rating tuần 6-12.
- Admin duyệt tin (UC19) theo kế hoạch để tuần 6+, tin đăng là `open` ngay.

## Việc phát sinh
- Không có thay đổi scope. Không thêm dependency mới (PostGIS dùng qua SQL functions, không cài GeoAlchemy2).

## Tiếp theo: Tuần 4 — AI Service MVP
Scaffold `ai-service` (FastAPI riêng, thêm vào compose), thêm mô tả tự do cho job seeker, cài `semantic` (TF-IDF), `time_feasibility`, `geo` score + unit test, chốt contract `POST /score` trả breakdown.
