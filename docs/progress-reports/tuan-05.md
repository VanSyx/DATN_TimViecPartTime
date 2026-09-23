# Báo cáo tiến độ — Tuần 5 (Tích hợp AI, chốt mốc 70%)

Branch: `feat/week5-integration` (tách từ `main` sau khi merge PR #12 Tuần 4). Ảnh minh chứng: `docs/screenshots/week5/`. Kế hoạch chi tiết: `docs/ke-hoach-tuan-05.md`.

## Đối chiếu kế hoạch (`PROJECT_PLAN.md` mục 5.1)

| Ngày | Kế hoạch | Kết quả |
|---|---|---|
| 1-2 | Backend gọi AI service, có fallback khi AI service down | ✅ Đạt: `GET /recommendations`, fallback theo khoảng cách |
| 3 | Frontend: danh sách gợi ý + breakdown điểm (explainable UI) | ✅ Đạt: trang "Gợi ý cho tôi" |
| 4 | Regression test toàn bộ luồng chính, fix bug | ✅ Đạt: 8 bước chạy trên UI thật, không phát sinh bug |
| 5 | Deploy bản 70% lên production, smoke test, rà DoD mốc tuần 5 | 🟡 Đã khai `timviec-ai` trong `render.yaml`. **Chờ người thực hiện** merge PR, tạo service trên Render và điền `AI_SERVICE_URL` (xem mục "Người thực hiện cần làm") |

**Deliverable "luồng chính end-to-end, AI gợi ý có breakdown, test xanh": đạt ở local. Phần "trên production" chờ bước deploy.**

## Chi tiết đã làm

**Backend** (`backend/app/jobs.py`, `config.py`)
- `GET /recommendations?lat&lng&radius_km=10`, chỉ job seeker (employer → 403, không token → 401).
- Lọc ứng viên dùng chung với `GET /jobs`: tách 2 hàm `open_jobs_query()` (đang mở, chưa quá hạn) và `nearby_jobs()` (`ST_DWithin`, gần → xa, tối đa 100). Không có ứng viên thì trả `items: []` và không gọi AI.
- Gửi `POST /score` cho AI service bằng `httpx`, timeout 5s. Payload gồm mô tả, vị trí, **các khoảng rảnh chưa qua** của seeker và danh sách job ứng viên.
- AI trả về bình thường → giữ nguyên thứ tự AI, gắn `source: "ai"`, trả `breakdown` + `travel_minutes`.
- **Fallback** khi lỗi kết nối, timeout, status khác 2xx hoặc body không phải JSON → `source: "fallback"`, xếp gần → xa, `final_score = 1 − d/R`, `breakdown = null`, ghi `log.warning`.

**Frontend** (`frontend/src/pages/JobPages.tsx`, `api.ts`, `App.tsx`)
- Thêm trang "Gợi ý cho tôi" vào menu của job seeker. Chọn vị trí bằng `LocationPicker` có sẵn (GPS, ghim, tra địa chỉ), sau đó chọn bán kính.
- Mỗi gợi ý hiện 4 thanh điểm bằng thẻ `<meter>` có sẵn của HTML, không cài thư viện chart: "Khớp mô tả", "Khớp giờ rảnh (tính cả X phút đi lại)", "Khoảng cách X km", "Độ tin cậy (mặc định, chưa có đánh giá)". Kèm "Điểm phù hợp" và nút ứng tuyển.
- Khi fallback, hiện banner "AI tạm thời không phản hồi — đang xếp theo khoảng cách" (ảnh 03).
- Nhắc khai hồ sơ khi thiếu mô tả hoặc **thiếu lịch rảnh sắp tới**, kèm link sang "Hồ sơ & lịch rảnh" (ảnh 02). Việc này chuyển từ báo cáo Tuần 4 sang.
- Tách nút ứng tuyển thành component `ApplyButton` để trang Tìm việc và trang Gợi ý dùng chung.

**Deploy**: thêm service `timviec-ai` vào `render.yaml` (Docker, free, `healthCheckPath: /health`, Dockerfile đã đọc `$PORT`).

**Tài liệu**: `.claude/docs/architecture.md` (contract `/recommendations` + fallback), `docs/design/sequence-diagram.md` mục 6 (fallback thực tế chỉ theo khoảng cách), `CLAUDE.md`.

## Kiểm thử

- Backend **44/44 pass**. Có 4 test mới:
  - fallback: trỏ `AI_SERVICE_URL` tới cổng không có service nghe, kết nối lỗi thật, không mock;
  - đường AI: backend giữ nguyên thứ tự AI trả về, không sắp lại theo khoảng cách, và gửi đúng payload;
  - vùng không có job thì không gọi AI;
  - RBAC.
- Test đặt job ở Cần Thơ vì `seed.py` không có dữ liệu ở đó, nên dữ liệu mẫu trong DB dev không lẫn vào kết quả.
- ai-service **21/21 pass**. Frontend `lint` 0 lỗi (2 cảnh báo fast-refresh cũ), `build` OK.
- **Chạy thật qua docker compose** với tài khoản seed `lan.nguyen`: 10 gợi ý đều có breakdown (ảnh 01). Tắt `ai-service` thì backend chuyển sang fallback sau ~4s và ghi log cảnh báo (ảnh 03).
- **Regression luồng chính trên UI** (Playwright điều khiển Edge, ảnh 04–11), **pass cả 8 bước**:

  | # | Bước | Ảnh |
  |---|---|---|
  | 1 | Employer đăng ký → xác minh (mã lấy từ log backend) | 04-dang-ky, 04-xac-minh |
  | 2 | Employer đăng tin "Dọn dẹp nhà cửa sáng thứ 7", 06 Phan Huy Ôn, Hải Châu, Đà Nẵng | 05, 06 |
  | 3 | Seeker đăng ký → xác minh → khai mô tả "Dọn dẹp nhà cửa, lau nhà, giặt đồ, rửa bát" + rảnh 7h–12h thứ 7 | 07 |
  | 4 | Gợi ý: tin mới đứng đầu, **83%** (khớp mô tả 55%, giờ rảnh 100%, cách 0.51 km). Tin trông trẻ buổi chiều gần đó chỉ 29% vì giờ rảnh 0% | 08 |
  | 5 | Seeker ứng tuyển từ trang gợi ý | 09 |
  | 6 | Employer xem đơn → Nhận | 10 |
  | 7 | Seeker thấy đơn "Đã nhận" | 11 |
  | 8 | Tắt ai-service → banner fallback, vẫn xếp theo khoảng cách, vẫn ứng tuyển được | 03 |

## Việc phát sinh

- **Fallback chỉ xếp theo khoảng cách, không "content-based cơ bản"** như `PROJECT_PLAN.md` 5.1 và sequence diagram ghi trước đó. Lý do: phần content-based chính là TF-IDF của AI service, nếu viết lại ở backend thì phải giữ 2 bản code chấm điểm song song. Fallback cần thật đơn giản để không hỏng cùng lúc với AI. Đã sửa sequence diagram mục 6.
- **Response không có `distance_km` ở cấp item** như bản nháp kế hoạch, vì `job.distance_km` (PostGIS) đã có sẵn, tránh trả 2 giá trị khoảng cách lệch nhau chút ít (PostGIS và Haversine).
- **Chỉ gửi khoảng rảnh chưa qua** sang AI: khoảng rảnh đã qua không giúp gì cho các job còn mở, và nhờ vậy danh sách không vượt giới hạn 500 khoảng/request của AI service khi seeker dùng lâu.
- Tin mới trong regression được **55%** "Khớp mô tả" vì mô tả viết cùng từ với mô tả của seeker, trong khi tin seed chỉ đạt ~0.02–0.10. Điều này khớp với nhận định Tuần 4: TF-IDF chỉ khớp đúng chữ, không hiểu từ đồng nghĩa ("tổng vệ sinh" ≠ "dọn dẹp").
- Ảnh Tuần 5 chụp tự động bằng Playwright cài trong thư mục tạm của session, **không thêm vào dự án** (không có dependency mới).

## Checklist DoD mốc tuần 5 (`PROJECT_PLAN.md` 11.1)

| Hạng mục | Trạng thái |
|---|---|
| FR1 Auth 3 vai trò + RBAC backend | ✅ |
| FR2 Job CRUD (đóng mềm) | ✅ |
| FR3 Lịch rảnh interval + tìm theo khu vực/khung giờ | ✅ |
| FR4 AI 4 thành phần + breakdown, hiển thị trên UI | ✅ (local) |
| FR5 Ứng tuyển / hủy / duyệt | ✅ |
| FR8 khung xác minh | ✅ (mã ghi vào log, đúng scope) |
| Rate limit + bcrypt | ✅ |
| Fallback khi AI down | ✅ |
| Test xanh luồng chính | ✅ backend 44, ai-service 21, regression UI 8 bước |
| CI/CD xanh + deploy + smoke test | 🟡 Chờ merge PR + tạo `timviec-ai` trên Render |
| Xác nhận GVHD phạm vi 70% | ✅ |

## Người thực hiện cần làm (bước deploy, agent không tự làm)

1. Mở PR `feat/week5-integration` → `main`, chờ CI xanh rồi merge.
2. Render dashboard → Blueprint → **Sync** để tạo `timviec-ai` từ `render.yaml`. Chờ `https://timviec-ai.onrender.com/health` trả `{"status":"ok"}`.
3. `timviec-backend` → Environment → `AI_SERVICE_URL=https://timviec-ai.onrender.com` → Save (backend tự deploy lại).
4. **Chụp màn hình** các bước 2–3 (che các secret khác nếu có), ghi vào `docs/setup-log.md` **dòng #14**, ảnh lưu ở `docs/screenshots/week5/`.
5. Báo lại để agent chạy smoke test production: `/health` của 2 service, đăng nhập, `GET /jobs`, `GET /recommendations` (có `source: "ai"`).
6. Ghi ngày tạo `timviec-db` (hạn 90 ngày của free tier, còn treo từ Tuần 1).

## Chưa làm / rủi ro

- Production vẫn chạy bản Tuần 4 cho tới khi xong mục trên.
- **Service free ngủ sau 15 phút**: lần gọi đầu tới `timviec-ai` có thể vượt 5s và rơi vào fallback. Đây là hành vi đúng. Trước khi demo, mở `/health` của `timviec-ai` để đánh thức.
- Render free có **750 giờ chạy/tháng dùng chung cho cả workspace**. 2 web service mà cùng thức 24/7 thì sẽ vượt, nhưng dùng cho demo thì service ngủ phần lớn thời gian nên không sao.
- `semantic` vẫn thấp với mô tả dùng từ khác nhau (giới hạn của TF-IDF), trọng số vẫn chọn tay. **Cần đánh giá offline (P@k, NDCG@k) trước khi khoá thiết kế AI ở tuần 6.**
- Regression UI chưa có trong CI (cần Vite + docker + trình duyệt). Chạy lại bằng tay trước mỗi lần deploy lớn.

## Tiếp theo: Tuần 6

1. Đánh giá offline trên dữ liệu `seed.py` (P@k, NDCG@k so với baseline sắp theo khoảng cách), rồi chốt trọng số.
2. Embedding (`sentence-transformers`) + pgvector. Kiểm tra RAM của Render free trước khi chọn model. **Khoá thiết kế AI sau tuần 6.**
3. Sau đó: FR6 rating (thay `trust = 1.0`), FR10 admin, FR7, FR9 (backlog ở `docs/ke-hoach-tuan-05.md` mục 7).
