# PROJECT PLAN — Nền tảng tìm việc Part-time/Helper tích hợp AI gợi ý

> Tài liệu này tập trung chi tiết vào **giai đoạn 1 (5 tuần đầu)** của đồ án tốt nghiệp — giai đoạn đạt mốc 70% chức năng cơ bản (bao gồm AI) và deploy production ổn định. Dự án tổng thể kéo dài 12 tuần; tuần 6-12 (hoàn thiện 30% còn lại + viết báo cáo) được tóm tắt ở mục 5.2 để giữ bối cảnh, không phải trọng tâm của tài liệu.

---

# 1. Project Overview

## 1.1 Tên đề tài
Nền tảng tìm kiếm việc làm Helper Part-time tích hợp AI gợi ý theo thời gian rảnh và vị trí

## 1.2 Vấn đề
Sinh viên và người có nhu cầu làm việc bán thời gian gặp khó khăn khi tìm việc phù hợp với lịch trống thực tế. Các nền tảng hiện có (TopCV, các job site part-time) chủ yếu lọc theo danh mục công việc cố định (ca sáng/chiều/tối) mà không xét đến:
- Khung giờ rảnh thực tế của người tìm việc (dạng interval, không phải ca cố định)
- Thời gian di chuyển thực tế từ vị trí người tìm việc đến nơi làm
- Độ tin cậy giữa hai bên trong mô hình "helper" — người lạ đến làm việc trực tiếp tại nhà/cơ sở

Đề tài "job site + AI gợi ý" khá phổ biến trong đồ án CNTT; nếu chỉ lọc + sắp xếp có trọng số cơ bản sẽ dễ bị đánh giá là biến thể nhỏ của sản phẩm có sẵn.

## 1.3 Giải pháp
Xây dựng nền tảng web kết nối Job Seeker và Employer cho công việc bán thời gian dạng helper, với AI gợi ý dựa trên **bốn yếu tố kết hợp**:

```
final_score = w1 × semantic_score + w2 × time_feasibility_score + w3 × geo_score + w4 × trust_modifier
```

- **Semantic matching:** so khớp ngữ nghĩa giữa mô tả công việc và nhu cầu người tìm việc (TF-IDF + cosine ở giai đoạn 1, nâng cấp embedding ở tuần 6+)
- **Time-feasibility scoring:** độ chồng lấp (overlap) giữa lịch rảnh dạng interval và khung giờ job, trừ thời gian di chuyển ước lượng (Haversine)
- **Geo score:** khoảng cách địa lý (PostGIS)
- **Trust modifier:** rating hai chiều tác động vào điểm gợi ý
- **Explainable AI:** hiển thị breakdown từng thành phần điểm

Thiết kế này giải quyết cold-start **bằng kiến trúc** (không cần dữ liệu lịch sử tương tác), khác Collaborative Filtering — vốn cần dữ liệu tương tác dày mà đồ án không có đủ thời gian để tích lũy.

## 1.4 Đối tượng người dùng
- **Job Seeker:** sinh viên và người có nhu cầu làm thêm
- **Employer:** cá nhân, hộ gia đình, cơ sở kinh doanh nhỏ cần thuê người theo giờ
- **Admin:** quản trị viên hệ thống

## 1.5 Khung thời gian & quy mô
- Đồ án tốt nghiệp **cá nhân** (1 người thực hiện toàn bộ backend, frontend, AI, deploy, báo cáo)
- Tổng thời gian: **12 tuần**
- **5 tuần đầu (giai đoạn 1 — trọng tâm tài liệu này):** đạt 70% chức năng cơ bản bao gồm AI (bản TF-IDF) + deploy production ổn định. Đây **không phải** mốc hoàn thành 100% dự án.
- **Tuần 6-12 (giai đoạn 2 — tóm tắt ở mục 5.2):** hoàn thiện 30% chức năng còn lại, nâng cấp AI, và song song viết báo cáo tốt nghiệp.

---

# 2. Scope

## 2.1 Scope bắt buộc — cuối tuần 5 (mốc 70%)
- Đăng ký/đăng nhập, phân quyền 3 vai trò: Job Seeker, Employer, Admin
- Khung xác minh email/SĐT: schema `users.verification_code` + endpoint `/auth/verify` (gửi mã thật qua provider để tuần 6-12)
- Employer đăng tin: vị trí, khung giờ cần, lương, mô tả tự do
- Job Seeker khai báo lịch rảnh dạng interval + mô tả tự do
- Tìm kiếm/lọc việc theo khu vực, khung giờ
- AI gợi ý việc làm bản TF-IDF: semantic + time-feasibility + geo + trust modifier, có explainable breakdown
- Ứng tuyển, quản lý trạng thái đơn, hủy đơn khi chưa được duyệt
- Deploy production ổn định, CI/CD chạy được, có smoke test

## 2.2 Scope hoàn thiện — tuần 6-12 (không chi tiết trong tài liệu này)
- Nâng cấp semantic_score từ TF-IDF sang embedding (sentence-transformers) + pgvector
- Rating 2 chiều đầy đủ sau khi hoàn thành công việc
- Trust & Safety đầy đủ: tích hợp provider gửi mã xác minh email/SMS thật (khung xác minh đã có từ tuần 1-5), report/block user
- Thông báo in-app
- Trang admin: duyệt tin, khóa/mở khóa tài khoản user, xử lý report
- Viết báo cáo tốt nghiệp hoàn chỉnh

## 2.3 Out of Scope (toàn dự án)
- Chat real-time
- Thanh toán/hoa hồng
- CV builder AI
- Collaborative Filtering (dữ liệu tương tác quá thưa trong phạm vi đồ án, không đủ điều kiện chứng minh hoạt động)
- Urgent match real-time (không đủ thời gian xây hạ tầng WebSocket/push riêng)

---

# 3. Requirements

## 3.1 Functional Requirements

| ID | Yêu cầu | Bắt buộc cuối tuần 5? |
|---|---|---|
| FR1 | Đăng ký/đăng nhập với 3 vai trò riêng biệt, phân quyền rõ ràng | ✅ Tuần 1-5 |
| FR2 | Employer tạo/sửa/xóa tin tuyển dụng (vị trí, khung giờ, lương, mô tả tự do) | ✅ Tuần 1-5 |
| FR3 | Job Seeker khai báo lịch rảnh dạng interval, tìm/lọc job theo khu vực và khung giờ | ✅ Tuần 1-5 |
| FR4 | Hệ thống tính điểm gợi ý AI theo công thức 4 thành phần, trả kèm breakdown lý do | ✅ Tuần 1-5 (bản TF-IDF) |
| FR5 | Job Seeker ứng tuyển, theo dõi trạng thái đơn, hủy đơn khi chưa duyệt; Employer duyệt/từ chối đơn | ✅ Tuần 1-5 |
| FR6 | Hai bên đánh giá (rating) lẫn nhau sau khi hoàn thành công việc | Tuần 6-12 |
| FR7 | Report/block người dùng; Admin xử lý report | Tuần 6-12 |
| FR8 | Xác minh SĐT/email khi đăng ký | ✅ Tuần 1-5 (schema + endpoint verify) — gửi mã thật qua provider: tuần 6-12 |
| FR9 | Thông báo in-app khi có sự kiện liên quan | Tuần 6-12 |
| FR10 | Admin duyệt tin đăng, khóa/mở khóa tài khoản user, xử lý report | Tuần 6-12 |

## 3.2 Non-functional Requirements
- **Hiệu năng:** Model embedding/TF-IDF chạy local, không phụ thuộc API ngoài — tránh độ trễ mạng và chi phí khi demo
- **Bảo mật:** JWT + refresh token, hashing password (bcrypt/argon2), RBAC enforce ở backend (không chỉ ẩn/hiện UI), rate limiting cho endpoint nhạy cảm
- **Độ tin cậy:** Có cơ chế fallback nếu AI service down (chỉ dùng geo/content-based nếu AI service không phản hồi)
- **Khả năng vận hành:** Logging/error tracking trên production (Sentry hoặc structured log tối thiểu)
- **Khả năng giải thích:** Mọi kết quả gợi ý AI phải hiển thị lý do (explainable AI), không phải hộp đen
- **Khả năng kiểm thử:** Có unit/integration test cho các luồng chính (auth, job CRUD, AI scoring)

## 3.3 Business Rules
- `final_score = w1×semantic_score + w2×time_feasibility_score + w3×geo_score + w4×trust_modifier`, tất cả thành phần chuẩn hóa [0,1] (min-max) trước khi nhân trọng số
- Giai đoạn 1 (mốc 70%, tuần 5): `semantic_score` dùng TF-IDF + cosine similarity; Giai đoạn 2 (tuần 6+): nâng cấp embedding (`sentence-transformers`) + pgvector
- `trust_modifier` mặc định trung lập (1.0) khi chưa có dữ liệu rating
- Không triển khai Collaborative Filtering
- Thiết kế thuật toán AI bị khóa (không đổi kiến trúc) sau tuần 6 để đảm bảo tính nhất quán với báo cáo

---

# 4. Architecture

## 4.1 Kiến trúc hệ thống
- Microservice tối giản: **Frontend (SPA) ↔ Backend chính (API) ↔ AI Service** (microservice riêng, giao tiếp qua REST API contract)
- Monorepo: 1 repo chứa frontend, backend, ai-service, docs
- Docker Compose chứa `db` + `backend` (+ `ai-service` từ tuần 4). Frontend không đóng container: local chạy Vite dev server, production deploy dạng static build (xem `.claude/docs/architecture.md`)
- AI service tách riêng để cô lập model, tránh làm nặng backend chính và cho phép nâng cấp AI độc lập theo giai đoạn (TF-IDF → embedding)

## 4.2 Technology Stack

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | React (Vite) + TailwindCSS | |
| Backend chính | Python FastAPI | Đồng bộ ngôn ngữ với AI service, giảm chi phí chuyển ngữ cảnh cho dev solo |
| AI Service | Python FastAPI (microservice riêng) | Model chạy local, không gọi API ngoài |
| Database | PostgreSQL 15+ + PostGIS + pgvector | PostGIS cho geo query, pgvector cho semantic search (từ tuần 6+) |
| Auth | JWT + refresh token | Hashing bcrypt/argon2 |
| CI/CD & Deploy | Docker + Docker Compose + GitHub Actions + Render (Blueprint) | |

## 4.3 Database — các entity chính
- `users` (role: job_seeker/employer/admin, thông tin xác minh)
- `jobs` (vị trí, khung giờ cần, lương, mô tả, vector embedding, employer_id)
- `availability_intervals` (lịch rảnh dạng interval của job seeker)
- `applications` (trạng thái đơn ứng tuyển, liên kết user-job)
- `ratings` (đánh giá hai chiều — tuần 6-12)
- `reports` (báo cáo vi phạm — tuần 6-12)
- `notifications` (thông báo in-app, FR9 — tuần 6-12)
- Extension bắt buộc: PostGIS (geo query), pgvector (semantic search, kích hoạt từ tuần 6+)

## 4.4 API
- Toàn bộ API viết theo OpenAPI/Swagger spec, xác định từ tuần 1 trước khi code
- Contract rõ ràng giữa backend chính và AI service: backend gửi user + danh sách job ứng viên, AI service trả danh sách đã xếp hạng kèm breakdown điểm từng thành phần
- Endpoint gợi ý AI bắt buộc trả breakdown, không chỉ 1 con số final_score

## 4.5 Security
- JWT + refresh token cho phiên đăng nhập
- Hashing password bằng bcrypt/argon2
- RBAC (3 role) enforce ở tầng backend, không chỉ ẩn/hiện UI
- Rate limiting cho endpoint nhạy cảm (đăng nhập, đăng ký)
- Không commit secret/credential vào git — quản lý qua `.env`
- Không tự động xử lý credential production — cần xác nhận thủ công khi deploy lần đầu

---

# 5. Timeline 5 tuần

## 5.1 Chi tiết theo tuần

### Tuần 1 — Setup & Thiết kế + Deploy Hello World
**Mục tiêu:** Nền móng kỹ thuật sẵn sàng, thiết kế hệ thống hoàn tất, pipeline deploy hoạt động.
| Ngày | Công việc |
|---|---|
| 1-2 | Setup monorepo (frontend/backend/ai-service/docs), Docker Compose local (Postgres+PostGIS+pgvector), khởi tạo GitHub repo + Actions cơ bản |
| 3-4 | Thiết kế ERD, use case diagram, sequence diagram cho luồng chính; viết OpenAPI spec khung |
| 5 | Deploy "Hello World" (FE + BE trả response đơn giản) lên production (Render), xác nhận CI/CD chạy được |
| — | **Việc quan trọng:** xác nhận với GVHD "mốc 70% có tính AI không" trước khi qua tuần 2 |

**Deliverable:** ERD/use case/sequence diagram, OpenAPI spec khung, Hello World chạy trên production, CI/CD xanh.
**Milestone M1 (cuối tuần 1): ✅ Đạt.** Deploy Hello World thành công (mục 9.4) + thiết kế hoàn tất (`docs/design/`). Còn lại: xác nhận GVHD về phạm vi 70%.

### Tuần 2 — Auth & RBAC, Frontend skeleton
| Ngày | Công việc |
|---|---|
| 1-2 | Backend: model `users`, đăng ký/đăng nhập, JWT + refresh token, hashing password, khung xác minh (cột `verification_code` + `/auth/verify`) |
| 3 | RBAC middleware (3 role), rate limiting cho login/register |
| 4-5 | Frontend: skeleton (routing, layout theo role), form đăng ký/đăng nhập kết nối API thật |

**Deliverable:** Auth + RBAC hoạt động end-to-end (backend enforce, không chỉ ẩn UI), frontend skeleton deploy được.

### Tuần 3 — Job CRUD, Application flow, Geo search
| Ngày | Công việc |
|---|---|
| 1-2 | Backend: model `jobs`, `availability_intervals`, CRUD job cho Employer |
| 3 | Geo search với PostGIS (lọc job theo khoảng cách/khu vực) |
| 4 | Backend: model `applications`, luồng ứng tuyển + trạng thái đơn |
| 5 | Frontend: trang đăng tin, danh sách job, filter theo khu vực/khung giờ, form ứng tuyển |

**Deliverable:** Job CRUD + tìm/lọc + ứng tuyển hoạt động đầy đủ trên cả FE/BE.

### Tuần 4 — AI Service MVP (giai đoạn rủi ro cao nhất)
| Ngày | Công việc |
|---|---|
| 1 | Setup AI service riêng (FastAPI), định nghĩa contract API với backend chính |
| 2 | Cài `semantic_score`: TF-IDF + cosine similarity trên mô tả job/nhu cầu |
| 3 | Cài `time_feasibility_score`: interval overlap + trừ thời gian di chuyển (Haversine) |
| 4 | Cài `geo_score` (chuẩn hóa khoảng cách PostGIS) + `trust_modifier` (mặc định 1.0) |
| 5 | Ghép công thức `final_score`, trả breakdown; viết unit test cho từng hàm tính điểm |

**Deliverable:** AI service chạy độc lập, trả kết quả gợi ý kèm breakdown, có unit test cho interval overlap/Haversine/TF-IDF scoring.
**Rủi ro cao:** Nếu trễ, ưu tiên cắt `trust_modifier` (giữ mặc định 1.0 toàn bộ tuần 4-5) để đảm bảo 3 thành phần còn lại chạy đúng hạn.

### Tuần 5 — Tích hợp AI vào luồng chính, chốt mốc 70%
| Ngày | Công việc |
|---|---|
| 1-2 | Backend gọi AI service, có fallback (dùng geo/content-based cơ bản nếu AI service down) |
| 3 | Frontend: hiển thị danh sách gợi ý + breakdown điểm (explainable UI) |
| 4 | Regression test toàn bộ luồng chính (auth → đăng tin → tìm việc → gợi ý AI → ứng tuyển), fix bug |
| 5 | Deploy bản 70% lên production, smoke test, rà soát lại Definition of Done mốc tuần 5 (mục 11.1) |

**Deliverable:** Luồng chính end-to-end hoạt động trên production, AI gợi ý có explainable breakdown, test xanh cho luồng chính.
**Milestone M2 (cuối tuần 5):** 70% chức năng cơ bản hoàn thành (bao gồm AI bản TF-IDF), deploy production ổn định.

## 5.2 Tóm tắt tuần 6-12 (ngoài phạm vi chi tiết của tài liệu này)
- Nhịp độ đề xuất mỗi tuần: xen kẽ ngày code / ngày viết báo cáo (ví dụ 3 ngày code – 3 ngày report), không dồn báo cáo về cuối
- **Code song song:** hoàn thiện 30% chức năng còn lại (FR6-FR10), nâng cấp `semantic_score` sang embedding + pgvector (khóa thiết kế sau tuần 6), security hardening, fix bug phát sinh
- **Report:** viết các chương báo cáo theo template của trường (cần bổ sung khi có template cụ thể — xem mục 10)
- **Testing:** không ưu tiên pilot test người dùng thật quy mô lớn do giới hạn thời gian — xem chi tiết mục 7
- Tuần 11-12: sửa theo góp ý GVHD, hoàn thiện nộp

---

# 6. Task Management

## 6.1 Công cụ & quy ước
- **Quản lý task:** GitHub Projects (board Kanban gắn với Issues) hoặc Trello — đủ cho 1 người, không cần công cụ nặng
- **Branching:** `main` (luôn deploy được) + branch tính năng ngắn hạn `feature/<ten-task>`, merge qua PR để CI chạy lint/test trước khi vào `main`
- **Commit:** message ngắn gọn theo dạng `<phạm vi>: <nội dung>` (vd: `auth: add JWT refresh endpoint`)
- **Definition of Ready cho mỗi task:** task phải được note rõ trong docs (mục 3 Requirements hoặc mục 5 Timeline), không mâu thuẫn với phạm vi đã chốt (mục 2 Scope) — không code tính năng ngoài kế hoạch mà không xác nhận trước

## 6.2 Bảng task theo tuần (5 tuần đầu)

| Tuần | Backend | Frontend | AI Service | Infra/Deploy |
|---|---|---|---|---|
| 1 | — | — | — | Docker Compose, CI skeleton, Hello World deploy |
| 2 | Auth, JWT, RBAC, rate limit, khung xác minh (FR8) | Layout, routing theo role, form login/register + nhập mã xác minh | — | — |
| 3 | Job CRUD, applications (gồm hủy đơn), geo search | Trang đăng tin, danh sách job, filter, form ứng tuyển | — | — |
| 4 | Contract API với AI service | — | TF-IDF semantic, time-feasibility, geo score, trust modifier, unit test | — |
| 5 | Tích hợp AI + fallback | UI hiển thị gợi ý + breakdown | Ghép final_score, tối ưu | Deploy bản 70%, smoke test |

## 6.3 Nhịp độ theo dõi
- Check-in cuối mỗi ngày làm việc: cập nhật trạng thái task trên board (Todo/In Progress/Done)
- Check-in cuối mỗi tuần: đối chiếu deliverable thực tế với deliverable kế hoạch (mục 5.1), điều chỉnh tuần kế tiếp nếu trễ

---

# 7. Testing

## 7.1 Test Strategy (giai đoạn 5 tuần)
- **Unit & integration test:** `pytest` cho backend và AI service — tập trung auth, RBAC, job CRUD, và đặc biệt các hàm tính điểm AI (interval overlap, Haversine distance, TF-IDF scoring)
- **Frontend:** smoke test cho luồng chính (đăng ký, đăng tin, tìm việc, ứng tuyển, xem gợi ý AI) — không yêu cầu coverage cao trong giai đoạn này
- **Offline evaluation AI:** Precision@k, Recall@k, NDCG@k trên **dữ liệu seed/mô phỏng** (do không đủ thời gian tuyển pilot tester trong 5 tuần), so sánh với baseline (sort theo thời gian đăng, lọc cứng không xếp hạng)
- **Giới hạn cần nêu rõ trong báo cáo:** dữ liệu offline evaluation mang tính mô phỏng nên đánh giá có thể mang tính circular một phần — minh bạch cách sinh dữ liệu, không phóng đại kết luận
- **Pilot test người dùng thật:** best-effort, không bắt buộc cho mốc tuần 5; nếu có thời gian sẽ thực hiện ở tuần 6+ song song với viết báo cáo (không phải điều kiện hoàn thành giai đoạn 1)

## 7.2 Acceptance Criteria — mốc tuần 5
- Auth 3 role hoạt động, RBAC enforce ở backend
- CRUD job, tìm/lọc theo khu vực + khung giờ hoạt động đúng
- Ứng tuyển + theo dõi trạng thái đơn hoạt động
- AI gợi ý chạy được (TF-IDF), hiển thị breakdown lý do
- Deploy production ổn định, CI/CD xanh, smoke test qua
- Test xanh cho các luồng chính (không có test đỏ)

---

# 8. Risk Management

| Rủi ro | Nguyên nhân | Mức độ | Cách phòng tránh |
|---|---|---|---|
| AI service trễ tiến độ | Chỉ có 1 tuần (tuần 4) cho toàn bộ AI, khối lượng lớn cho 1 người | Cao | Dùng TF-IDF đơn giản trước; nếu trễ, giữ `trust_modifier` mặc định 1.0 để đảm bảo 3 thành phần còn lại đúng hạn |
| Nhầm lẫn phạm vi "70% cơ bản" | GVHD và người thực hiện hiểu khác nhau về việc AI có tính vào 70% không | Cao nếu không xử lý | Xác nhận trực tiếp với GVHD trong tuần 1, trước khi bắt đầu dev (mục 5.1 tuần 1) |
| AI service down ảnh hưởng luồng chính | Phụ thuộc cứng giữa backend và AI service | Trung bình | Cơ chế fallback (dùng geo/content-based cơ bản) khi AI service không phản hồi |
| Dữ liệu offline evaluation mang tính circular | Dữ liệu mô phỏng sinh ra từ chính công thức đang được đánh giá | Trung bình | Minh bạch trong báo cáo cách sinh dữ liệu mô phỏng (mục 7.1) |
| Collaborative Filtering không chứng minh được hoạt động | Dữ liệu tương tác thưa, vòng đời job ngắn | Đã loại bỏ | Không triển khai CF; dùng semantic + time-feasibility thay thế |
| Report bị code "ăn" hết thời gian ở tuần 6-12 | Không giữ kỷ luật chia thời gian code/report | Trung bình | Bám lịch xen kẽ ngày code/ngày report mỗi tuần (mục 5.2) |
| Không đủ dữ liệu pilot test thật để phân tích | Không ưu tiên thời gian tuyển pilot tester (đã xác nhận với người thực hiện) | Chấp nhận được nếu minh bạch | Nêu rõ giới hạn này trong báo cáo, không phóng đại kết luận (mục 7.1) |
| Deploy lỗi ở phút chót | Dồn việc deploy về cuối dự án | Trung bình | Deploy Hello World từ tuần 1, deploy lại mỗi tuần để phát hiện lỗi hạ tầng sớm |
| Render free Postgres bị xóa giữa dự án | Free tier chỉ giữ DB 90 ngày kể từ lúc tạo — ~tuần 13 tính từ tuần 1, sát mốc nộp báo cáo tuần 12 | Cao | Ghi lại ngày tạo DB; nâng lên plan trả phí (~$7/tháng) trước ngày hết hạn nếu cần production sống qua tuần 12; hoặc export/backup dữ liệu định kỳ từ tuần 9+ đề phòng |
| Render free web service cold start chậm | Service free tier ngủ sau 15 phút không có traffic, request đầu tiên mất 30-50s để dậy | Thấp, ảnh hưởng lúc demo | "Đánh thức" service vài phút trước khi demo/báo cáo trực tiếp; nêu rõ giới hạn free tier nếu GVHD hỏi vì sao chậm lần đầu |

---

# 9. Deployment

## 9.1 Environment
- **Local:** Docker Compose (`db` Postgres+PostGIS, `backend`; `ai-service` thêm từ tuần 4; pgvector thêm từ tuần 6) + frontend chạy ngoài compose bằng Vite dev server
- **Production:** Render — backend deploy bằng Docker (Blueprint `render.yaml` ở root), Postgres dùng managed database của Render (free tier, xem rủi ro mục 8)
- **Biến môi trường cần thiết:** `DATABASE_URL` (Render tự inject từ managed DB), `JWT_SECRET`, `JWT_REFRESH_SECRET`, `AI_SERVICE_URL`, `EMBEDDING_MODEL_PATH`, `CORS_ORIGINS` — không commit vào git; các biến secret khai trong `render.yaml` với `sync: false` để Render bắt buộc nhập tay qua dashboard, không tự động hóa

## 9.2 CI/CD
- GitHub Actions: chạy lint + test tự động khi push lên `main` / mở PR (không gate việc deploy — Render tự build/deploy song song khi push vào `main`, độc lập với CI)
- Render Blueprint tự động build lại và deploy khi có commit mới vào `main` (auto-deploy), không cần bước deploy thủ công sau lần setup đầu
- Deploy "Hello World" ngay từ tuần 1 để xác nhận pipeline hoạt động, tránh dồn rủi ro hạ tầng về cuối

## 9.3 Production checklist (sau mỗi lần deploy)
- Chạy smoke test kiểm tra endpoint chính còn sống (auth, job list, AI recommend)
- Kiểm tra logging/error tracking hoạt động (Sentry hoặc structured log tối thiểu)
- Việc nhập secret/credential và phê duyệt deploy lần đầu lên production cần xác nhận thủ công, không để agent/tự động hóa tự ý thực hiện

## 9.4 Production URLs (✅ đã deploy — Tuần 1 ngày 5)
| Service | URL | Trạng thái |
|---|---|---|
| Backend (`timviec-backend`) | https://timviec-backend.onrender.com | ✅ `/health` → `200 {"status":"ok"}` |
| Frontend (`datn-timviecparttime`) | https://datn-timviecparttime.onrender.com | ✅ `200`, HTML phục vụ được |
| Database (`timviec-db`) | quản lý qua Render dashboard, connection string inject vào `DATABASE_URL` của backend | Tạo cùng lúc backend qua Blueprint |

**Việc còn lại trước khi dùng thật ở Tuần 2 (không chặn M1):**
- [ ] Xác nhận `CORS_ORIGINS` trên `timviec-backend` đã trỏ đúng `https://datn-timviecparttime.onrender.com` (backend hiện chưa có middleware CORS — thêm khi làm auth ở Tuần 2, lúc đó điền biến này mới có tác dụng)
- [ ] Ghi lại ngày tạo `timviec-db` để theo dõi mốc hết hạn free tier 90 ngày (mục 8 — Risk)

<details>
<summary>Các bước đã thực hiện (tham khảo khi cần deploy lại/tạo môi trường mới)</summary>

1. Đăng nhập [render.com](https://render.com) bằng GitHub, cấp quyền truy cập repo `VanSyx/DATN_TimViecPartTime`
2. **New → Blueprint** → chọn repo này → Render tự đọc `render.yaml` ở root → tạo `timviec-backend` (web service) + `timviec-db` (Postgres)
3. Điền tay các biến `sync: false` trong dashboard của `timviec-backend`: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `AI_SERVICE_URL`, `CORS_ORIGINS`
4. Verify `https://timviec-backend.onrender.com/health` trả `{"status":"ok"}`
5. **New → Static Site** (tạo tay qua dashboard, không nằm trong `render.yaml`) → chọn cùng repo → Root Directory: `frontend`, Build Command: `npm ci && npm run build`, Publish Directory: `dist`
</details>

---

# 10. Documentation

| Tài liệu | Trạng thái / Ghi chú |
|---|---|
| `PROJECT_PLAN.md` (tài liệu này) | Nguồn tham chiếu chính cho giai đoạn 5 tuần đầu |
| `docs/de-cuong.md` | Mô tả chi tiết đề tài, gửi GVHD duyệt tuần 1 — cần tạo |
| `docs/design/erd.md`, `docs/design/use-case.md`, `docs/design/sequence-diagram.md` | Thiết kế hệ thống (Mermaid, render sẵn trên GitHub) — ✅ đã tạo |
| API spec (OpenAPI/Swagger) | Hoàn thành khung tuần 1, cập nhật liên tục khi có thay đổi endpoint |
| `CLAUDE.md` | Hướng dẫn workflow cho AI agent, quy tắc coding, giới hạn tuyệt đối — cần tạo |
| Báo cáo tốt nghiệp (các chương) | **Cần template của trường:** người thực hiện xác nhận trường có template riêng nhưng chưa cung cấp chi tiết. Khi có, bổ sung cấu trúc chương cụ thể vào đây trước khi bắt đầu viết ở tuần 6. Tạm thời áp dụng cấu trúc phổ biến (Mở đầu, Cơ sở lý thuyết, Phân tích thiết kế, Cài đặt, Kiểm thử & đánh giá, Kết luận) làm khung nháp nếu cần viết sớm |

---

# 11. Definition of Done

## 11.1 DoD — Mốc tuần 5 (giai đoạn 1)
- [ ] FR1-FR5 + khung FR8 (schema xác minh + endpoint verify) hoạt động đúng trên production
- [ ] RBAC được enforce ở backend, có rate limiting và hashing password đúng chuẩn
- [ ] AI service chạy ổn định (bản TF-IDF), có explainable breakdown hiển thị trên UI
- [ ] Có cơ chế fallback khi AI service down
- [ ] Test xanh cho các luồng chính (auth, job CRUD, AI scoring), không còn test đỏ
- [ ] CI/CD xanh, đã deploy production, đã smoke test
- [ ] Đã xác nhận với GVHD về phạm vi "70% cơ bản" (mục 5.1 tuần 1)

## 11.2 DoD — Toàn bộ dự án (tham chiếu cho tuần 6-12)
- [ ] Tất cả FR1-FR10 hoạt động đúng trên production
- [ ] AI service nâng cấp lên embedding + pgvector, vẫn có explainable breakdown
- [ ] Có tối thiểu một tập dữ liệu offline evaluation (Precision@k/Recall@k/NDCG@k so sánh baseline); dữ liệu pilot test thật (nếu có) là điểm cộng, không bắt buộc
- [ ] Có cơ chế Trust & Safety tối thiểu hoạt động (xác minh, report/block)
- [ ] Production có logging/error tracking, đã smoke test sau mỗi lần deploy
- [ ] Báo cáo tốt nghiệp hoàn chỉnh theo template của trường, có nêu rõ giới hạn (không có pilot test quy mô lớn, phạm vi không triển khai CF)
- [ ] Đã rehearsal demo, có kịch bản dự phòng nếu lỗi mạng/AI service khi trình bày

## 11.3 DoD theo từng loại hoạt động
| Giai đoạn | Điều kiện hoàn thành |
|---|---|
| Idea/Plan | Task được note rõ trong docs/, không mâu thuẫn với phạm vi đã chốt (mục 2) |
| Dev | Code chạy được local, pass lint |
| Fix Bug | Có regression test, issue đóng kèm test đó |
| Test | Test xanh toàn bộ cho luồng liên quan |
| Deploy | CI/CD xanh, smoke test qua, đã xác nhận secret/production thủ công |
| Report | Có số liệu/dữ liệu thật hỗ trợ, nội dung đã được người thực hiện duyệt |
