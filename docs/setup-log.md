# Setup Log — nhật ký cài đặt môi trường & triển khai

Ghi lại mỗi bước cài đặt môi trường/công cụ ngay lúc làm (ảnh chụp màn hình lưu ở `docs/screenshots/`, đặt tên `NN-mo-ta-ngan.png`). Dùng làm tư liệu cho chương Cài đặt/Triển khai của báo cáo tốt nghiệp — xem quy tắc ở `CLAUDE.md` mục 5.

## Việc cần làm ngay: bù lại các bước đã bỏ lỡ (Tuần 1-2)

Các bước dưới đây đã hoàn thành trước khi có quy tắc này nên chưa có ảnh gốc theo đúng thời điểm làm. Không thể quay lại đúng khoảnh khắc, nhưng có thể bù bằng 2 cách — đánh dấu cách nào dùng cho từng dòng trong bảng bên dưới rồi điền:

- **Chụp lại trạng thái hiện tại**: với cấu hình vẫn còn sống (Docker Desktop, Render dashboard, GitHub repo settings...), mở lại và chụp ngay bây giờ — báo cáo ghi rõ "ảnh chụp cấu hình hiện tại" thay vì "ảnh chụp lúc cài đặt", vẫn hợp lệ vì hầu hết báo cáo đồ án chỉ cần minh chứng cấu hình đúng, không bắt buộc ảnh live từng bước.
- **Dẫn chứng bằng commit**: với việc chỉ xảy ra 1 lần và không có gì để chụp lại (vd. một lệnh cài đặt đã chạy xong), trích dẫn commit hash + ngày làm code diff trong repo làm bằng chứng thời điểm, ghi rõ trong cột Ghi chú.

| # | Ngày (ước tính) | Bước | Cách bù | Trạng thái |
|---|---|---|---|---|
| 1 | Tuần 1 | Cài Docker Desktop, chạy `docker compose up -d` lần đầu (db + backend) | Chụp lại `docker compose up -d` + `docker ps` hiện tại | Hoàn thành 
| 2 | Tuần 1 | Tạo GitHub repo, bật GitHub Actions | Chụp tab Actions hiện tại (lịch sử run vẫn còn)  Hoàn thành 
| 3 | Tuần 1 ngày 5 | Tạo Render Blueprint (`timviec-backend` + `timviec-db`), nhập secret lần đầu | Chụp Render dashboard hiện tại (service list, tab Environment che giá trị secret) | Hoàn thành |
| 4 | Tuần 1 ngày 5 | Tạo Render Static Site cho frontend (tạo tay, không qua Blueprint) | Chụp cấu hình Static Site hiện tại (Build Command, Publish Directory) | Hoàn thành |
| 5 | Tuần 2 | Alembic migration đầu tiên cho bảng `users` | Dẫn commit thêm file trong `backend/alembic/versions/` | Hoàn thành |
| 6 | Tuần 2 ngày 3-5 | Cài `slowapi`, `react-router-dom`; rebuild container backend | Dẫn commit `67c1434` (RBAC/rate limit/CORS + frontend skeleton) | Hoàn thành |

## Từ bây giờ: log các bước mới

| # | Ngày | Bước | Ảnh | Ghi chú |
|---|---|---|---|---|
| 7 | 2026-09-15 (Tuần 3) | Migration `658771f39e2e`: bật extension PostGIS + tạo bảng `jobs` (cột `location` geography sinh tự động + GiST index), `availability_intervals`, `applications` | `screenshots/week3/01-alembic-migration.png` | Có `CREATE EXTENSION IF NOT EXISTS postgis` vì Postgres managed của Render không bật sẵn như image `postgis/postgis`. Kiểm tra lại khi deploy lên Render |
| 8 | 2026-09-15 (Tuần 3) | Chạy E2E trên UI thật + chụp ảnh tự động bằng Edge headless (Chrome DevTools Protocol, Node 22) | `screenshots/week3/02..12-*.png` | Không cài thêm tool (không Playwright); ảnh chụp do agent tự sinh trong lúc test luồng chính |
| 9 | 2026-09-15 (Tuần 3) | Migration `ffbf3dd8cc02`: thêm cột địa chỉ `street`/`ward`/`city` cho `jobs`. Ban đầu định geocode qua Goong Maps API nhưng bỏ vì Goong cần admin duyệt key và Nominatim (OSM) chặn IP server — thay bằng chọn toạ độ trên bản đồ Leaflet/OSM ở frontend, không cần API/key bên thứ 3 | `screenshots/week3/16..*.png` | Địa chỉ chỉ để hiển thị; `lat`/`lng` lấy từ điểm ghim người dùng tự chọn |
| 10 | 2026-09-19 (Tuần 3) | Kiểm tra production sau khi merge PR #9, #10: migration bật PostGIS chạy được trên Postgres managed của Render | — | `curl` `/health` 200, `openapi.json` có đủ route Tuần 3, `GET /jobs?lat&lng` 200 (có `ST_DWithin`) |
| 11 | 2026-09-19 (Tuần 4) | Scaffold `ai-service` (FastAPI riêng, `python:3.12-slim`, cổng 8001), thêm vào `docker-compose.yml`; backend nhận `AI_SERVICE_URL=http://ai-service:8001` | `screenshots/week4/02-docker-compose-ai-service.png`, `03-ai-service-swagger.png` | Chỉ phụ thuộc `fastapi`/`uvicorn` — TF-IDF tự cài bằng thư viện chuẩn nên image nhẹ, không cần scikit-learn. Chưa thêm lên Render (Tuần 5) |
| 12 | 2026-09-19 (Tuần 4) | Migration `ba48e75efca4`: thêm cột `users.description` (mô tả tự do của job seeker) | `screenshots/week4/01-alembic-user-description.png` | Thử cả `downgrade -1` rồi `upgrade head`; `alembic check` không lệch model |
| 13 | 2026-09-19 (Tuần 4) | Thêm job `ai-service` vào GitHub Actions CI (`pip install` + `pytest`, không cần service DB) | `screenshots/week4/06-pytest-ai-service.png` | Ảnh là lần chạy local; ảnh run trên tab Actions chụp sau khi push |
