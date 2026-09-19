# Báo cáo tiến độ — Tuần 4 (AI Service MVP)

Branch: `feat/week4-ai` (tách từ `feat/week3-jobs`). Ảnh minh chứng: `docs/screenshots/week4/`.

## Đối chiếu kế hoạch (`PROJECT_PLAN.md` mục 5.1)

| Ngày | Kế hoạch | Kết quả |
|---|---|---|
| 1 | Setup AI service riêng (FastAPI), định nghĩa contract API với backend | ✅ Đạt — `ai-service/`, compose cổng 8001, contract `POST /score` ghi ở `.claude/docs/architecture.md` |
| 2 | `semantic_score`: TF-IDF + cosine | ✅ Đạt |
| 3 | `time_feasibility_score`: interval overlap + trừ thời gian di chuyển (Haversine) | ✅ Đạt |
| 4 | `geo_score` + `trust_modifier` (mặc định 1.0) | ✅ Đạt (geo dùng Haversine, xem "Việc phát sinh") |
| 5 | Ghép `final_score`, trả breakdown; unit test từng hàm | ✅ Đạt — 20 test |

**Deliverable "AI service chạy độc lập, trả kết quả gợi ý kèm breakdown, có unit test cho interval overlap/Haversine/TF-IDF": đạt.**

## Chi tiết đã làm

**AI service** (`ai-service/app/scoring.py`, `main.py`)
- `semantic`: TF-IDF + cosine tự cài bằng thư viện chuẩn Python. Token = âm tiết + bigram âm tiết (vì từ tiếng Việt thường gồm 2 âm tiết), chuẩn hóa Unicode NFC để chữ có dấu gõ theo kiểu tổ hợp hay dựng sẵn vẫn ra cùng token.
- `time_feasibility`: tỉ lệ khung `[bắt đầu − đi, kết thúc + về]` nằm trong hợp các khoảng rảnh (gộp khoảng chồng nhau trước, không đếm trùng). Thời gian đi = Haversine / 20 km/h.
- `geo`: `1 − min(d, R)/R`, R = bán kính tìm kiếm.
- `trust`: 1.0 cho mọi job (chưa có `ratings`, đúng phạm vi đã chốt với GVHD).
- `final = 0.35·semantic + 0.35·time + 0.2·geo + 0.1·trust`, trả kèm `breakdown`, `distance_km`, `travel_minutes`, đã sắp giảm dần.
- Demo thật (ảnh 04): người tìm việc ở Hồ Hoàn Kiếm, mô tả "dọn dẹp nhà cửa, lau nhà, giặt đồ", rảnh 7h-12h thứ Bảy → xếp hạng: dọn nhà gần (0.79) > dọn nhà Long Biên 4.4 km (0.70) > trông trẻ sát bên nhưng không khớp mô tả (0.65) > dọn nhà buổi tối ngoài giờ rảnh (0.38, `time_feasibility = 0`). Breakdown giải thích được lý do từng vị trí.

**Mô tả tự do của job seeker** (việc còn nợ từ Tuần 3, Scope 2.1)
- Migration `ba48e75efca4`: cột `users.description` (ảnh 01).
- `PATCH /auth/me` — chỉ job seeker (employer → 403); `GET /auth/me` trả thêm `description`.
- Frontend: ô "Mô tả bản thân" trên trang "Hồ sơ & lịch rảnh" (ảnh 05, đã kiểm tra lưu xong tải lại vẫn còn).

**Hạ tầng**: `ai-service` trong `docker-compose.yml` (ảnh 02), Swagger ở `:8001/docs` (ảnh 03), thêm job CI `ai-service`.

**Kiểm thử**
- `ai-service`: **20/20 pass** (ảnh 06) — Haversine (1° vĩ độ = 111.195 km, Hà Nội–TP.HCM ≈ 1.140 km), gộp interval, rảnh trọn/không rảnh/thời gian đi làm giảm điểm/khoảng rảnh chồng nhau không đếm trùng/rảnh rời rạc, geo tuyến tính, TF-IDF (job liên quan xếp trên, giống hệt = 1, không chung từ = 0, mô tả trống = 0, NFC), endpoint (xếp hạng + đủ 4 thành phần breakdown, khung giờ ngược → 422, danh sách rỗng).
- Backend: **38/38 pass** (ảnh 07; thêm 2 test mô tả tự do + RBAC).
- `npm run lint` + `npm run build` pass; `alembic check` không lệch model.

## Việc phát sinh
- **Tuần 3 — đóng lại**: kiểm tra production sau PR #9, #10: `/health` 200, đủ route Tuần 3, geo search 200 → PostGIS chạy được trên Postgres managed của Render. Đã push commit `f9c9964` (Photon + đổi tile) và sửa 1 comment lỗi thời trong `models.py` (vẫn ghi "geocode Goong ở backend").
- **TF-IDF tự cài thay vì scikit-learn**: chỉ ~20 dòng, giữ image AI service nhẹ (chỉ `fastapi` + `uvicorn`) → khởi động nguội trên Render free nhanh hơn. Công thức giống `TfidfVectorizer` mặc định (smooth IDF + chuẩn hóa L2) nên kết quả so sánh được khi viết báo cáo.
- **Chuẩn hóa theo cận cố định thay vì min-max theo lô**: min-max theo lô làm điểm một job phụ thuộc các job khác trong lô (job tốt nhất luôn được 1 dù khớp kém), và lô 1 job thì chia cho 0. Các thành phần đã tự nằm trong [0,1] (cosine, tỉ lệ thời gian, `1 − d/R`). Đã sửa câu chữ ở `PROJECT_PLAN.md` mục 3.3 và `.claude/docs/ai_scoring.md`.
- **geo_score dùng Haversine thay vì `ST_Distance` của PostGIS**: để AI service không phụ thuộc DB và dùng chung 1 khoảng cách với thời gian đi; sai khác < 0.5% ở bán kính ≤ 100 km. PostGIS vẫn dùng ở backend để lọc trước job ứng viên (`ST_DWithin`).
- **Bỏ cột `USERS.location` khỏi ERD**: vị trí job seeker lấy theo từng lần tìm (GPS/ghim bản đồ), như luồng tìm việc Tuần 3 đang làm.
- `source: "ai" | "fallback"` chuyển sang cho backend gắn (sequence diagram mục 6 đã sửa), vì chỉ backend biết mình có đang chạy fallback hay không.

## Chưa làm / giới hạn đã biết
- Backend chưa gọi AI service, chưa có `GET /recommendations` + fallback, chưa có UI gợi ý — đúng kế hoạch Tuần 5.
- `ai-service` chưa có trên Render — thêm vào `render.yaml` ở Tuần 5 (tạo service mới trên Render là bước thủ công của người thực hiện, cần chụp màn hình).
- Trọng số chọn tay; chưa đánh giá offline (Precision@k/NDCG@k) — cần làm trước mốc khóa tuần 6.
- IDF tính trên lô job của từng request → lô nhỏ thì IDF kém ổn định. Chấp nhận ở bản TF-IDF, embedding tuần 6 không còn vấn đề này.
- Tốc độ di chuyển là hằng số 20 km/h, không tính kẹt xe/đường thật.
- PR `feat/week3-jobs` → `main` (commit `f9c9964`, `944b418`) cần người thực hiện mở và merge (máy chưa cài `gh`).

## Tiếp theo: Tuần 5 — Tích hợp AI, chốt mốc 70%
Backend `GET /recommendations` gọi `POST /score` (timeout ngắn + fallback theo geo), UI "Gợi ý cho tôi" hiển thị breakdown, regression test luồng chính, thêm `ai-service` vào Render và deploy bản 70%.
