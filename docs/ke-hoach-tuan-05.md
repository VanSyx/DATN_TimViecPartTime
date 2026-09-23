# Kế hoạch Tuần 5 — Tích hợp AI, chốt mốc 70%

Soạn 2026-09-22, sau khi rà toàn bộ repo (branch `feat/week4-ai`, commit `5da6453`). Đối chiếu: `PROJECT_PLAN.md` mục 5.1 Tuần 5 + mục 11.1 (DoD mốc tuần 5).

## 0. Việc dọn trước khi code (≈30 phút)

| # | Việc | Vì sao |
|---|---|---|
| 0.1 | Mở PR `feat/week4-ai` → `main`, chờ CI xanh, merge. Sau đó `git checkout main && git pull`, tạo `feat/week5-integration` | `origin/main` mới có Tuần 3; 5 commit Tuần 4 chưa vào `main` nên chưa lên production. `main` local cũng đang tụt sau `origin/main` |
| 0.2 | Thư mục cha `D:\DATN_TimViecPartTime` là **một git repo khác** (1 commit "Initial commit", branch `feature/docker-compose-skeleton`, cùng remote `origin`), README bị xoá và repo thật nằm lồng bên trong dưới dạng untracked. Không commit gì từ thư mục cha. Nên chuyển repo thật ra ngoài, hoặc xoá `.git` của thư mục cha | Đẩy nhầm từ thư mục cha sẽ tạo lịch sử rác trên cùng remote GitHub |
| 0.3 | Bật Docker Desktop (lúc rà soát daemon đang tắt) → `docker compose up -d` → chạy `pytest` backend | Lần rà này chưa chạy lại được 40 test backend (cần DB) |

**Trạng thái kiểm tra ngày 2026-09-22:** ai-service `21 passed`; frontend `lint` 0 lỗi (2 cảnh báo fast-refresh, vô hại) và `build` OK; backend **chưa chạy** (Docker tắt).

**Cập nhật 2026-09-23:** Docker đã bật, `docker compose up -d` OK (`/health` backend + ai-service 200). Backend **40 passed**, ai-service **21 passed**, `alembic check` không lệch model. 0.3 xong; 0.1 chờ người thực hiện mở/merge PR trên GitHub (máy chưa có `gh`); 0.2 chờ người thực hiện quyết định.

## 1. Backend — `GET /recommendations` + fallback (ngày 1-2)

**File:** thêm route vào `backend/app/jobs.py` (không tạo module mới: chỉ 1 route với 1 hàm gọi HTTP).

```
GET /recommendations?lat&lng&radius_km=10      (job_seeker only)
→ 200 { "source": "ai" | "fallback",
        "items": [{ "job": JobOut, "final_score": float,
                    "breakdown": {semantic, time_feasibility, geo, trust} | null,
                    "distance_km": float, "travel_minutes": float | null }] }
```

Luồng xử lý:
1. **Lọc ứng viên**: tách phần tạo query của `search_jobs` thành 1 hàm dùng chung (`open`, chưa quá hạn, `ST_DWithin`), để 2 route chạy cùng một logic lọc. Bắt buộc có `lat`/`lng`, vì AI cần vị trí. Chưa có ứng viên nào thì trả `items: []` ngay, không gọi AI.
2. Lấy `user.description` và `availability_intervals` của seeker.
3. Gọi `POST {AI_SERVICE_URL}/score` bằng `httpx` (đã có trong `requirements.txt`), đặt `timeout=5`. Payload theo contract ở `.claude/docs/architecture.md`, trong đó `id` = `str(job.id)`.
4. Gọi thành công: ghép kết quả với `JobOut` theo `job_id`, giữ nguyên thứ tự AI trả về, rồi đặt `source: "ai"`.
5. **Fallback** khi gặp `httpx.HTTPError` hoặc status khác 2xx: sắp theo `distance_km` tăng dần (đã có sẵn từ PostGIS), gán `final_score = 1 − d/R` và `breakdown = null`, đặt `source: "fallback"`, rồi `log.warning` nguyên nhân.
6. `config.py`: `AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8001")`.

**Test** (`backend/tests/test_jobs.py`, dùng lại fixture sẵn có):
- Fallback: `monkeypatch` `AI_SERVICE_URL` trỏ tới cổng chết (`http://127.0.0.1:9`), kiểm tra `source == "fallback"` và thứ tự gần → xa. Không cần mock.
- Đường AI: `monkeypatch` hàm gọi AI để trả kết quả giả, kiểm tra `source == "ai"`, thứ tự theo điểm và có breakdown.
- RBAC: employer gọi thì nhận 403, không có token thì nhận 401 hoặc 403.

## 2. Frontend — trang "Gợi ý cho tôi" (ngày 3)

- `api.ts`: thêm `recommendations(params)` và type `Recommendation`.
- `JobPages.tsx`: thêm `RecommendPage`, dùng lại `LocationPicker`, `JobInfo`, `useSubmit` và nút ứng tuyển của `SearchJobsPage`.
- `App.tsx`: thêm 1 dòng `{ path: '/seeker/recommend', label: 'Gợi ý cho tôi', ... }` vào `pagesByRole.job_seeker`. Comment trong file đã chừa chỗ cho trang này.
- Breakdown dùng thẻ `<meter>` có sẵn của HTML (không cài thư viện chart). Mỗi thành phần 1 dòng: "Khớp mô tả", "Khớp giờ rảnh (tính cả X phút đi lại)", "Khoảng cách X km", "Độ tin cậy (mặc định)".
- `source === "fallback"` → hiện banner "AI tạm thời không phản hồi — đang xếp theo khoảng cách".
- Nhắc khai hồ sơ nếu `description` trống hoặc chưa có lịch rảnh, kèm link sang "Hồ sơ & lịch rảnh". Việc này chuyển từ báo cáo Tuần 4 sang: không có lịch rảnh thì `time_feasibility = 0` với mọi job.

## 3. Regression test luồng chính (ngày 4)

Chạy tay trên UI với dữ liệu `seed.py` theo thứ tự: đăng ký → xác minh (mã lấy từ log) → employer đăng tin → seeker khai mô tả + lịch rảnh → gợi ý (xem breakdown) → ứng tuyển → employer duyệt → seeker thấy "Đã nhận". Tắt `ai-service` (`docker compose stop ai-service`) để kiểm tra banner fallback. Chụp ảnh vào `docs/screenshots/week5/`.

## 4. Deploy bản 70% (ngày 5) — **người thực hiện làm tay, agent không tự làm**

1. `render.yaml`: thêm service `timviec-ai` (`type: web`, `runtime: docker`, `dockerContext: ./ai-service`, `dockerfilePath: ./ai-service/Dockerfile`, `plan: free`, `healthCheckPath: /health`). Dockerfile đã đọc sẵn `$PORT`.
2. Trên Render dashboard: Blueprint sync để tạo `timviec-ai`, sau đó điền `AI_SERVICE_URL=https://timviec-ai.onrender.com` cho `timviec-backend`. **Chụp màn hình và ghi vào `docs/setup-log.md` (dòng #13).**
3. Smoke test production: `/health` của cả 2 service, đăng nhập, `GET /jobs`, `GET /recommendations`.
4. Lưu ý khi demo: cả 2 service free đều ngủ sau 15 phút. Lần gọi đầu có thể vượt timeout 5s và rơi vào fallback, **đây là hành vi đúng, không phải lỗi**. Mở `/health` của `timviec-ai` vài phút trước khi demo để đánh thức service.
5. Ghi ngày tạo `timviec-db` (hạn 90 ngày của free tier). Việc này còn treo từ Tuần 1, mục 9.4.

## 5. Checklist DoD mốc tuần 5 (`PROJECT_PLAN.md` 11.1)

| Hạng mục | Hiện trạng |
|---|---|
| FR1 Auth 3 vai trò + RBAC backend | ✅ Xong (admin chỉ tạo tay trong DB; trang admin là placeholder, đúng scope) |
| FR2 Job CRUD (đóng mềm) | ✅ Xong |
| FR3 Lịch rảnh interval + tìm theo khu vực/khung giờ | ✅ Xong |
| FR4 AI 4 thành phần + breakdown | 🟡 AI service xong (21 test). **Còn thiếu:** backend gọi AI + UI breakdown |
| FR5 Ứng tuyển / hủy / duyệt | ✅ Xong (UPDATE có điều kiện chống race) |
| FR8 khung xác minh | ✅ Xong (mã ghi vào log, chưa gửi thật, đúng scope) |
| Rate limit + bcrypt | ✅ Xong |
| Fallback khi AI down | ❌ Tuần 5 mục 1 |
| Test xanh luồng chính | 🟡 ai-service 21/21; backend 40/40 ở lần chạy cuối (Tuần 4). Cần thêm test `/recommendations` |
| CI/CD xanh + deploy + smoke test | 🟡 Production đang chạy bản Tuần 3; cần merge Tuần 4 và 5 rồi thêm `timviec-ai` |
| Xác nhận GVHD phạm vi 70% | ✅ Xong |

## 6. Tài liệu lệch với thực tế — ✅ đã sửa 2026-09-23

CORS production đã kiểm tra (preflight trả đúng origin) → tick 9.4; mục 10 cập nhật trạng thái `CLAUDE.md`/`de-cuong.md`; dòng lỗi thời cuối `CLAUDE.md` đã thay; `frontend/README.md` viết lại. Còn treo: ngày tạo `timviec-db` (xem mục 4.5).

<details><summary>Danh sách gốc</summary>


- `PROJECT_PLAN.md` 9.4: ô "CORS_ORIGINS" vẫn chưa tick, nhưng middleware CORS đã có từ Tuần 2.
- `PROJECT_PLAN.md` 10: ghi `CLAUDE.md` là "cần tạo", thực tế đã có. `docs/de-cuong.md` vẫn chưa tồn tại.
- `CLAUDE.md` cuối file: dòng "Dev Commands có lệnh thật sau khi scaffold xong Tuần 1" đã lỗi thời.
- `frontend/README.md`: vẫn là README mẫu của Vite, không nói gì về dự án.
</details>

## 7. Sau mốc 70% — backlog tuần 6-12 (thứ tự đề xuất)

1. **Đánh giá offline** (P@k, NDCG@k so với baseline sắp theo thời gian/khoảng cách) trên dữ liệu `seed.py`. **Phải làm trước khi khoá thiết kế AI ở tuần 6**, vì trọng số hiện vẫn chọn tay.
2. **Embedding** (`sentence-transformers`) + pgvector: đổi image db sang bản có pgvector (comment `ponytail:` trong `docker-compose.yml`). Kiểm tra RAM của free tier Render trước khi chọn model, vì model đa ngôn ngữ nhỏ nhất cũng khoảng 100 MB+.
3. FR6 rating 2 chiều → thay `trust: 1.0` bằng giá trị lấy từ bảng `ratings`.
4. FR10 admin: duyệt tin (`pending_approval` đã có sẵn trong model), khoá/mở khoá user (`is_blocked` đã được check ở `get_current_user`).
5. FR7 report/block, FR9 thông báo in-app.
6. FR8 gửi mã thật: chỉ cần thay thân hàm `send_verification_code` trong `auth.py`, không phải sửa chỗ gọi.
7. Nợ kỹ thuật đã đánh dấu `ponytail:` trong code: phân trang `/jobs` (>100 job), refresh token không thu hồi được, rate limit theo IP (người dùng chung wifi chặn lẫn nhau), `--forwarded-allow-ips='*'`, tốc độ di chuyển cố định 20 km/h.
