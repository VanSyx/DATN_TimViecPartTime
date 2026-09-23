# CLAUDE.md

## 1. Project Overview
Nền tảng web kết nối Job Seeker và Employer cho công việc bán thời gian dạng "helper" (giúp việc theo giờ tại nhà/cơ sở). Điểm khác biệt: AI gợi ý job dựa trên khớp ngữ nghĩa + độ khả thi thời gian rảnh (dạng interval thực, không phải ca cố định) + khoảng cách địa lý + độ tin cậy — có giải thích lý do gợi ý (explainable AI), không phải lọc cứng theo category.

Đồ án tốt nghiệp cá nhân, 12 tuần. 5 tuần đầu = đạt 70% chức năng cơ bản (bao gồm AI) + deploy production ổn định.

## 2. Tech Stack
| Thành phần | Công nghệ |
|---|---|
| Frontend | React (Vite) + TailwindCSS |
| Backend chính | Python FastAPI |
| AI Service | Python FastAPI (microservice riêng, tách khỏi backend chính) |
| Database | PostgreSQL 15+ + PostGIS + pgvector |
| Auth | JWT + refresh token, bcrypt/argon2 |
| CI/CD | Docker + Docker Compose + GitHub Actions |
| Deploy | Render (Blueprint `render.yaml`) — backend Docker web service + managed Postgres, frontend static site tạo tay qua dashboard |

## 3. Dev Commands
```
docker compose up -d                          # db (postgis) + backend :8000 + ai-service :8001 (/health, /docs)
cd backend && .venv/Scripts/python -m pytest  # test backend (cần db đang chạy)
cd ai-service && .venv/Scripts/python -m pytest  # unit test AI scoring (không cần db)
docker compose exec backend python seed.py    # dữ liệu mẫu kiểu người dùng thật (19 tài khoản, mật khẩu matkhau123), chạy lại được
cd frontend && npm run dev                    # frontend → http://localhost:5173
cd frontend && npm run build                  # build production
```
Lần đầu setup ngoài Docker (lặp lại cho `ai-service/`): `cd backend && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt`

**Migration (Alembic)** — chạy từ `backend/`, cần `DATABASE_URL` trỏ host port **5433**:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/timviec" JWT_SECRET=dev JWT_REFRESH_SECRET=dev \
  .venv/Scripts/python -m alembic revision --autogenerate -m "mô tả"
DATABASE_URL="..." ... .venv/Scripts/python -m alembic upgrade head
```
Container tự chạy `alembic upgrade head` khi khởi động, không cần upgrade tay sau khi `docker compose up`.

**Lưu ý cổng DB:** máy dev đã có PostgreSQL cài sẵn chiếm 5432, nên compose map host port **5433** → `db:5432`. Nối từ host (alembic, psql, test) dùng 5433; service trong compose vẫn dùng `db:5432`.

**Frontend không nằm trong docker-compose** — chạy trực tiếp bằng Vite dev server (nhanh hơn, và production deploy dạng static build). Compose chứa db + backend + ai-service. Backend gọi `ai-service` qua `GET /recommendations` (fallback theo khoảng cách khi AI không phản hồi). `ai-service` chưa có trên Render — thêm vào `render.yaml` ở bước deploy Tuần 5.

## 4. Core Logic Summary
Điểm gợi ý job = tổ hợp có trọng số của 4 thành phần: `semantic_score` (khớp mô tả), `time_feasibility_score` (chồng lấp lịch rảnh, trừ thời gian di chuyển), `geo_score` (khoảng cách), `trust_modifier` (rating). Cài đặt ở `ai-service/app/scoring.py` (TF-IDF tự cài, không dùng thư viện ML — tuần 6 mới thêm `sentence-transformers`). Chi tiết công thức, business rules, lộ trình nâng cấp: **`.claude/docs/ai_scoring.md`**.

## 5. Key Constraints
- **Không code tính năng ngoài Scope đã chốt** (`docs/PROJECT_PLAN.md` mục 2) mà không xác nhận trước với người thực hiện.
- **Không triển khai Collaborative Filtering** — quyết định kiến trúc đã chốt (lý do: `.claude/docs/ai_scoring.md`).
- **Thiết kế công thức AI bị khóa sau tuần 6** — không đổi kiến trúc scoring sau mốc này.
- **RBAC phải enforce ở backend**, không chỉ ẩn/hiện UI. Chi tiết: `.claude/docs/security.md`.
- **Không tự động xử lý secret/credential production** — deploy lần đầu và nhập secret cần xác nhận thủ công từ người thực hiện, agent không tự ý làm.
- **Mốc cuối tuần 5 = 70% chức năng, không phải 100%** — đừng giả định toàn bộ FR đã xong chỉ vì đang ở tuần 5.
- Endpoint gợi ý AI luôn phải trả breakdown điểm (explainable), không chỉ 1 số `final_score`.
- `availability_intervals` là interval thời gian thực, không phải enum ca cố định — đừng đơn giản hóa lại.
- **Vị trí nhập bằng địa chỉ + ghép ghim trên bản đồ, không bắt người dùng tự gõ lat/lng.** Form địa chỉ theo địa giới 2 cấp (từ 1/7/2025): số nhà + đường / phường-xã / tỉnh-thành phố + bản đồ Leaflet để chọn toạ độ chính xác. 3 cách lấy toạ độ: tra địa chỉ (nút "Định vị trên bản đồ"), bấm/kéo ghim, GPS trình duyệt.
- **Geocoding chỉ chạy phía client, không bao giờ ở backend.** Dùng Photon (`photon.komoot.io`, dữ liệu OSM, miễn phí, không cần API key) gọi thẳng từ trình duyệt — tránh đúng 2 lý do đã loại Goong (cần admin duyệt key) và Nominatim (chặn IP server/cloud). **Đừng thêm geocoding vào backend mà không hỏi trước.** Giới hạn đã biết, không phải bug: OSM Việt Nam thiếu dữ liệu số nhà nên kết quả chỉ chính xác tới mức tên đường/địa danh, và địa chỉ không tồn tại vẫn có thể trả match sai — vì vậy **luôn hiện danh sách kết quả cho người dùng chọn, không tự ghim theo kết quả đầu tiên**, và toạ độ cuối cùng do người dùng xác nhận bằng ghim.
- **Tile bản đồ dùng `tile.openstreetmap.de`** (mirror của OSM), không dùng `tile.openstreetmap.org` (hay bị chặn/timeout tuỳ mạng) và không dùng CARTO (`basemaps.cartocdn.com` nay trả tile watermark "API KEY REQUIRED").
- **Mọi bước cài đặt môi trường/công cụ triển khai** (cài Docker, setup DB, tạo service trên Render, cấu hình CI/CD, cài tool mới...) **phải chụp màn hình + ghi chú lại ngay lúc làm**, không dồn về sau — phục vụ chương Cài đặt/Triển khai trong báo cáo tốt nghiệp. Khi hướng dẫn hoặc thực hiện các bước này, nhắc người thực hiện chụp và ghi vào `docs/setup-log.md` (ảnh lưu ở `docs/screenshots/`) trước khi coi bước đó là xong.
- **Kết thúc mỗi tuần phải có báo cáo tiến độ** trước khi bắt đầu tuần kế tiếp: đối chiếu deliverable/task đã hoàn thành so với kế hoạch (`docs/PROJECT_PLAN.md` mục 5.1/6.2), nêu việc phát sinh ngoài kế hoạch, việc chưa xong/rủi ro, và việc cần làm ở tuần sau. Lưu vào `docs/progress-reports/tuan-<N>.md` và trình bày lại trong hội thoại trước khi code tuần mới.

## 6. Additional Documentation
- `docs/PROJECT_PLAN.md` — nguồn tham chiếu chính: Scope, Requirements, Timeline 5 tuần, Testing, Risk, Deployment, Definition of Done.
- `docs/progress-reports/` — báo cáo tiến độ cuối mỗi tuần (xem mục 5).
- `.claude/docs/architecture.md` — kiến trúc microservice, API contract backend ↔ AI service.
- `.claude/docs/database.md` — entity, PostGIS/pgvector.
- `.claude/docs/ai_scoring.md` — công thức AI đầy đủ, business rules.
- `.claude/docs/security.md` — auth, RBAC, secrets.

## Khi nào cập nhật file này
Cập nhật CLAUDE.md ngay khi có bất kỳ thay đổi nào trong số sau — đừng để lệch với thực tế dự án:
- Đổi tech stack (thêm/bớt công nghệ, đổi version quan trọng)
- Đổi kiến trúc hệ thống (thêm service, đổi cách giao tiếp giữa các service)
- Thêm/bớt entity database chính
- Đổi công thức hoặc thành phần AI scoring
- Chuyển giai đoạn milestone (vd: qua mốc tuần 5, khóa thiết kế AI ở tuần 6)
- Thêm/đổi lệnh chạy, test, migration, seed (mục 3)
