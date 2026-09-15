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
docker compose up -d                          # db (postgis) + backend → http://localhost:8000/health
cd backend && .venv/Scripts/python -m pytest  # test backend
cd frontend && npm run dev                    # frontend → http://localhost:5173
cd frontend && npm run build                  # build production
```
Lần đầu setup backend ngoài Docker: `cd backend && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt`

**Frontend không nằm trong docker-compose** — chạy trực tiếp bằng Vite dev server (nhanh hơn, và production deploy dạng static build). Compose chỉ chứa db + backend. `ai-service` chưa scaffold, sẽ thêm ở Tuần 4.

## 4. Core Logic Summary
Điểm gợi ý job = tổ hợp có trọng số của 4 thành phần: `semantic_score` (khớp mô tả), `time_feasibility_score` (chồng lấp lịch rảnh, trừ thời gian di chuyển), `geo_score` (khoảng cách), `trust_modifier` (rating). Chi tiết công thức, business rules, lộ trình nâng cấp: **`.claude/docs/ai_scoring.md`**.

## 5. Key Constraints
- **Không code tính năng ngoài Scope đã chốt** (`docs/PROJECT_PLAN.md` mục 2) mà không xác nhận trước với người thực hiện.
- **Không triển khai Collaborative Filtering** — quyết định kiến trúc đã chốt (lý do: `.claude/docs/ai_scoring.md`).
- **Thiết kế công thức AI bị khóa sau tuần 6** — không đổi kiến trúc scoring sau mốc này.
- **RBAC phải enforce ở backend**, không chỉ ẩn/hiện UI. Chi tiết: `.claude/docs/security.md`.
- **Không tự động xử lý secret/credential production** — deploy lần đầu và nhập secret cần xác nhận thủ công từ người thực hiện, agent không tự ý làm.
- **Mốc cuối tuần 5 = 70% chức năng, không phải 100%** — đừng giả định toàn bộ FR đã xong chỉ vì đang ở tuần 5.
- Endpoint gợi ý AI luôn phải trả breakdown điểm (explainable), không chỉ 1 số `final_score`.
- `availability_intervals` là interval thời gian thực, không phải enum ca cố định — đừng đơn giản hóa lại.

## 6. Additional Documentation
- `docs/PROJECT_PLAN.md` — nguồn tham chiếu chính: Scope, Requirements, Timeline 5 tuần, Testing, Risk, Deployment, Definition of Done.
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
- Dev Commands có lệnh thật sau khi scaffold xong Tuần 1
