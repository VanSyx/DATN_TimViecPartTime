# Sequence Diagrams — Toàn bộ luồng chính

> Mỗi section ứng với 1 FR (`docs/PROJECT_PLAN.md` mục 3.1). Nguồn contract Backend↔AI Service: `.claude/docs/architecture.md`. Các thao tác CRUD đối xứng (sửa/xóa job) gộp chung 1 diagram bằng nhánh `alt` thay vì vẽ lặp lại — nội dung vẫn đủ, không bớt luồng nào.

## 1. Đăng ký + Xác minh Email/SĐT (FR1, FR8)

```mermaid
sequenceDiagram
    actor U as User (JS/EMP)
    participant FE as Frontend
    participant BE as Backend chính
    participant DB as PostgreSQL

    U->>FE: Điền form đăng ký (email, phone, password, role)
    FE->>BE: POST /auth/register
    BE->>BE: Hash password (bcrypt/argon2)
    BE->>DB: INSERT users (email_verified=false, phone_verified=false)
    BE->>BE: Sinh verification_code (random, hash trước khi lưu)
    BE->>DB: UPDATE users SET verification_code, verification_code_expires_at
    BE-->>U: Gửi code qua email/SMS (provider ngoài)
    BE-->>FE: 201 Created { user_id }

    U->>FE: Nhập verification_code
    FE->>BE: POST /auth/verify { user_id, code }
    alt code đúng và chưa hết hạn
        BE->>DB: UPDATE users SET email_verified/phone_verified = true
        BE-->>FE: 200 OK
    else code sai hoặc hết hạn
        BE-->>FE: 400 Bad Request
    end
```

**Ghi chú:** nếu tuần 1-5 không kịp tích hợp provider gửi email/SMS thật, đăng ký cho phép hoạt động với `email_verified=false` (không chặn đăng nhập) — hoàn thiện bước gửi/xác minh thật ở tuần 6+ (xem `docs/design/use-case.md` ghi chú UC3).

---

## 2. Đăng nhập + Refresh Token (FR1)

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend
    participant BE as Backend chính
    participant DB as PostgreSQL

    U->>FE: Nhập email/password
    FE->>BE: POST /auth/login
    BE->>DB: SELECT user WHERE email
    alt is_blocked = true
        BE-->>FE: 403 Forbidden (tài khoản bị khóa)
    else password đúng
        BE->>BE: Ký JWT access token (ngắn hạn) + refresh token (dài hạn)
        BE-->>FE: 200 OK { access_token, refresh_token }
    else password sai
        BE-->>FE: 401 Unauthorized
    end

    Note over FE,BE: Khi access token hết hạn
    FE->>BE: POST /auth/refresh { refresh_token }
    alt refresh token hợp lệ
        BE-->>FE: 200 OK { access_token mới }
    else refresh token hết hạn/thu hồi
        BE-->>FE: 401 Unauthorized → FE chuyển về trang login
    end
```

---

## 3. Employer: Đăng / Sửa / Đóng tin tuyển dụng (FR2)

```mermaid
sequenceDiagram
    actor E as Employer
    participant FE as Frontend
    participant BE as Backend chính
    participant DB as PostgreSQL

    E->>FE: Điền form job (vị trí, khung giờ, lương, mô tả)
    FE->>BE: request kèm JWT
    BE->>BE: RBAC check role = employer

    alt Đăng tin mới (POST /jobs)
        BE->>DB: INSERT jobs (status = open, employer_id từ JWT)
    else Sửa tin (PUT /jobs/:id)
        BE->>DB: SELECT jobs WHERE id — kiểm tra employer_id khớp JWT
        BE->>DB: UPDATE jobs
    else Đóng/Xóa tin (DELETE /jobs/:id hoặc PATCH status=closed)
        BE->>DB: SELECT jobs WHERE id — kiểm tra employer_id khớp JWT
        BE->>DB: UPDATE jobs SET status = closed
    end

    BE-->>FE: 200/201 OK
```

**Ghi chú:** kiểm tra `employer_id` khớp JWT là bắt buộc ở mọi nhánh sửa/đóng — RBAC role-level không đủ, còn cần ownership check để employer A không sửa được job của employer B.

---

## 4. Admin: Duyệt tin đăng (FR10)

```mermaid
sequenceDiagram
    actor A as Admin
    participant FE as Frontend
    participant BE as Backend chính
    participant DB as PostgreSQL
    participant N as Notification (FR9)

    A->>FE: Mở danh sách job status=pending_approval
    FE->>BE: GET /admin/jobs?status=pending_approval
    BE-->>FE: Danh sách job chờ duyệt

    A->>FE: Duyệt hoặc từ chối 1 job
    FE->>BE: PATCH /admin/jobs/:id { decision }
    alt Duyệt
        BE->>DB: UPDATE jobs SET status = open
        BE->>N: Tạo notification cho employer (type=job_approved)
    else Từ chối
        BE->>DB: UPDATE jobs SET status = rejected
        BE->>N: Tạo notification cho employer (type=job_rejected)
    end
    BE-->>FE: 200 OK
```

**Ghi chú:** nếu tuần 1-5 chưa cài UC19, job mặc định `status=open` ngay khi đăng (bỏ bước duyệt) — không chặn luồng chính; bật lại bước duyệt này khi làm FR10 ở tuần 6+.

---

## 5. Job Seeker: Khai báo lịch rảnh + Tìm/lọc job (FR3)

```mermaid
sequenceDiagram
    actor JS as Job Seeker
    participant FE as Frontend
    participant BE as Backend chính
    participant DB as PostgreSQL

    JS->>FE: Thêm khoảng thời gian rảnh (start_time, end_time)
    FE->>BE: POST /availability
    BE->>DB: INSERT availability_intervals
    BE-->>FE: 201 Created

    JS->>FE: Tìm job theo khu vực + khung giờ
    FE->>BE: GET /jobs?lat&lng&radius&time_range
    BE->>DB: SELECT jobs WHERE ST_DWithin(location, point, radius) AND status='open'
    BE->>DB: Lọc thêm theo overlap time_range (không dùng AI, chỉ lọc thô)
    BE-->>FE: Danh sách job khớp geo + khung giờ
```

**Ghi chú:** đây là tìm/lọc **thô** (geo + time filter trực tiếp bằng SQL/PostGIS), khác với luồng gợi ý AI ở mục 6 — user có thể dùng UC5 độc lập mà không cần AI service chạy.

---

## 6. Gợi ý AI (FR4)

```mermaid
sequenceDiagram
    actor U as Job Seeker
    participant FE as Frontend
    participant BE as Backend chính
    participant AI as AI Service
    participant DB as PostgreSQL

    U->>FE: Mở trang "Gợi ý cho tôi"
    FE->>BE: GET /recommendations
    BE->>DB: Lấy availability_intervals + location của user
    BE->>DB: Lấy danh sách jobs ứng viên (lọc geo/status=open trước)
    BE->>AI: POST /score { user, jobs[] }

    alt AI service phản hồi bình thường
        AI->>AI: Tính semantic + time_feasibility + geo + trust cho từng job
        AI-->>BE: [{ job_id, final_score, breakdown, source: "ai" }]
    else AI service down / timeout
        BE->>BE: Fallback: xếp hạng theo geo_score + content-based cơ bản
        Note over BE: source: "fallback" — không giả vờ là kết quả AI đầy đủ
    end

    BE-->>FE: Danh sách job đã xếp hạng + breakdown
    FE-->>U: Hiển thị list + lý do gợi ý (explainable AI)
```

---

## 7. Ứng tuyển → Duyệt/Từ chối → Thông báo (FR5, FR9)

```mermaid
sequenceDiagram
    actor JS as Job Seeker
    actor E as Employer
    participant FE as Frontend
    participant BE as Backend chính
    participant DB as PostgreSQL
    participant N as Notification

    JS->>FE: Ứng tuyển job
    FE->>BE: POST /applications { job_id }
    BE->>DB: INSERT applications (status = pending)
    BE->>N: Tạo notification cho employer (type=new_application)
    BE-->>FE: 201 Created

    JS->>FE: Xem trạng thái đơn của mình
    FE->>BE: GET /applications/me
    BE->>DB: SELECT applications WHERE job_seeker_id
    BE-->>FE: Danh sách đơn + trạng thái hiện tại

    E->>FE: Duyệt hoặc từ chối đơn
    FE->>BE: PATCH /applications/:id { decision }
    alt Duyệt
        BE->>DB: UPDATE applications SET status = accepted
        BE->>N: Tạo notification cho job seeker (type=application_status, accepted)
    else Từ chối
        BE->>DB: UPDATE applications SET status = rejected
        BE->>N: Tạo notification cho job seeker (type=application_status, rejected)
    end
    BE-->>FE: 200 OK

    Note over JS,FE: Job Seeker cũng có thể hủy đơn khi status=pending
    JS->>FE: Hủy đơn
    FE->>BE: PATCH /applications/:id { status: cancelled }
    BE->>DB: UPDATE applications SET status = cancelled (chỉ khi status hiện tại = pending)
```

---

## 8. Đánh giá hai chiều sau khi hoàn thành (FR6)

```mermaid
sequenceDiagram
    actor U as User (JS hoặc EMP)
    participant FE as Frontend
    participant BE as Backend chính
    participant DB as PostgreSQL

    Note over BE,DB: Điều kiện: applications.status = completed
    U->>FE: Đánh giá đối phương (score 1-5 + comment)
    FE->>BE: POST /ratings { application_id, ratee_id, score, comment }
    BE->>DB: Kiểm tra application.status = completed và user là rater hợp lệ
    BE->>DB: INSERT ratings
    BE-->>FE: 201 Created

    Note over BE: trust_modifier của ratee được AI service đọc lại (runtime, không cache)<br/>ở lần gợi ý AI tiếp theo — xem .claude/docs/ai_scoring.md
```

---

## 9. Report / Block user → Admin xử lý (FR7)

```mermaid
sequenceDiagram
    actor U as User (JS/EMP)
    actor A as Admin
    participant FE as Frontend
    participant BE as Backend chính
    participant DB as PostgreSQL

    U->>FE: Report user khác (kèm lý do)
    FE->>BE: POST /reports { reported_id, reason }
    BE->>DB: INSERT reports (status = pending)
    BE-->>FE: 201 Created

    A->>FE: Mở danh sách report pending
    FE->>BE: GET /admin/reports?status=pending
    BE-->>FE: Danh sách report

    A->>FE: Xử lý report (dismiss hoặc block user bị báo cáo)
    FE->>BE: PATCH /admin/reports/:id { decision }
    alt Block
        BE->>DB: UPDATE users SET is_blocked = true WHERE id = reported_id
        BE->>DB: UPDATE reports SET status = resolved, resolved_at = now()
    else Dismiss (report không hợp lệ)
        BE->>DB: UPDATE reports SET status = dismissed, resolved_at = now()
    end
    BE-->>FE: 200 OK
```

---

## 10. Admin: Khóa / Mở khóa tài khoản user (FR10)

```mermaid
sequenceDiagram
    actor A as Admin
    participant FE as Frontend
    participant BE as Backend chính
    participant DB as PostgreSQL

    A->>FE: Mở danh sách user, chọn 1 user
    FE->>BE: GET /admin/users
    BE-->>FE: Danh sách user

    A->>FE: Khóa hoặc mở khóa tài khoản
    FE->>BE: PATCH /admin/users/:id { is_blocked }
    BE->>DB: UPDATE users SET is_blocked = :value
    BE-->>FE: 200 OK
    Note over BE: User bị khóa (is_blocked=true) sẽ bị chặn ở bước login (xem mục 2)
```

## Ghi chú chung
- Tất cả sequence diagram trên map đúng 1:1 với FR1-FR10 — không có FR nào thiếu luồng minh họa.
- 10 diagram này là **thiết kế mức API/luồng dữ liệu**, chưa phải đặc tả endpoint chi tiết — OpenAPI spec thật sinh tự động từ FastAPI khi code (`/docs`), không cần viết tay riêng.
