# Báo cáo tiến độ — Tuần 6 (Thiết kế lại UI, đánh giá offline, khoá thiết kế AI)

Branch: `feat/week6-ui` (đã merge `main`, `f37e738`) và `feat/week6-ai` (2 commit, **chờ push + merge**). Ảnh minh chứng: `docs/screenshots/week6/`. Kiểm thử chi tiết: `docs/test-cases.md` mục 19–20.

## Đối chiếu kế hoạch (`PROJECT_PLAN.md` mục 5.2)

| Hạng mục | Kết quả |
|---|---|
| Thiết kế lại UI (Tailwind v4, mockup Claude Design, trang chủ S0, chỉ laptop) | ✅ Merge `main` (`f37e738`), 205/205 test case đạt trước merge |
| Đánh giá offline P@k/NDCG@k trên seed, so với 2 baseline | ✅ `backend/offline_eval.py` (commit `8da6847`) |
| Khoá thiết kế AI | ✅ 2026-09-30: giữ TF-IDF + trọng số `0.35/0.35/0.2/0.1`, **bỏ embedding/pgvector** (commit `bc938c8`) |
| Chốt deploy bản 70% (còn treo từ Tuần 5) | ✅ `AI_SERVICE_URL` đã đặt, smoke test production 7/7, tổng **213/213** |

## Chi tiết đã làm

**UI**: code lại toàn bộ frontend theo mockup; component dùng chung `src/ui.tsx`, `src/job-ui.tsx`; bản đồ Leaflet với tile `tile.openstreetmap.de`, geocoding Photon phía client (xem CLAUDE.md mục 5).

**Đánh giá offline** (6 nhân vật × 10 tin, nhãn 0/1/2 gán tay theo câu chuyện nhân vật):

| Cách xếp | P@3 | NDCG@3 | R@5 | NDCG@5 |
|---|---|---|---|---|
| Gần nhất trước (chế độ dự phòng) | 0.53 | 0.56 | 0.83 | 0.64 |
| Lọc cứng trùng giờ rảnh, rồi gần nhất | 0.67 | 0.86 | 0.90 | 0.89 |
| **AI (0.35/0.35/0.2/0.1)** | **0.73** | **0.92** | **0.95** | **0.94** |

Dò lưới trọng số không đáng đổi (lưới đẩy trọng số khoảng cách về 0 vì nhãn không xét khoảng cách; kiểm tra chéo chỉ hơn ở 2/6 nhân vật). **Giới hạn phải nêu trong báo cáo tốt nghiệp**: nhãn và dữ liệu đều do người thực hiện gán, không phải người dùng thật. Chi tiết: `.claude/docs/ai_scoring.md`.

**Bỏ embedding**: model đa ngôn ngữ + torch vượt 512 MB RAM của Render free, và TF-IDF đã vượt cả 2 baseline. Cập nhật `PROJECT_PLAN.md`, `CLAUDE.md`, `architecture.md`, `database.md`, `security.md`, `erd.md`, comment `ponytail:` trong `scoring.py`, `docker-compose.yml`.

## Bug phát hiện khi kiểm thử

| Bug | Mức | Mô tả | Xử lý |
|---|---|---|---|
| #1 LOGIN-11 | Cao | Đăng xuất bị đẩy sang `/login?next=…` do RequireRole thấy mất user trước khi điều hướng xong | Đã sửa |
| #2 SRCH-16 | Trung bình | Nhãn "Đã ứng tuyển · Chờ duyệt" làm thẻ gọn tràn | Đã sửa |
| #3 PROD-06 | Cao | Production luôn ở chế độ fallback vì thiếu `AI_SERVICE_URL` | Đặt biến, đạt (setup-log #16) |

Quan sát chưa xử lý (chỉ thẩm mỹ): O1 ghim tiền công của 2 tin cùng địa chỉ chồng nhau; O2 ở 1366×768 nhãn "Khoảng cách · 20%" xuống 2 dòng.

## Việc phát sinh ngoài kế hoạch
- Chạy E2E tự động toàn bộ `docs/test-cases.md` bằng `playwright-core` + Edge headless (cài ở scratchpad, không thêm vào dự án — setup-log #15).
- Tài liệu hoá lại các điểm lệch giữa docs và production sau review.

## Chưa làm / rủi ro
- **`feat/week6-ai` chưa merge** — merge = deploy production (chỉ comment + script chạy tay + docs, rủi ro thấp).
- Mục 17 để lại 2 tài khoản `qa-prod-*@example.org` trên production (chưa có API xoá tài khoản).
- Free tier ngủ sau 15 phút: gọi đầu vào `timviec-ai` có thể quá 5s và rơi vào fallback (đúng thiết kế); đánh thức `/health` trước khi demo.
- `timviec-db` free hết hạn sau 90 ngày kể từ Tuần 1 — **cần ghi ngày tạo và có kế hoạch di chuyển/tạo lại trước ngày hết hạn**.
- Regression UI chưa nằm trong CI.
- Chưa có template báo cáo của trường (`PROJECT_PLAN.md` mục 10) — cần trước khi viết chương.

## Tiếp theo: Tuần 7
Phần 30% còn lại, theo thứ tự: **FR6** rating 2 chiều (thay `trust = 1.0`) → **FR10** admin (duyệt tin, khoá user) → **FR7** report/block + **FR9** thông báo in-app → **FR8** gửi mã thật. Xen kẽ ngày viết báo cáo tốt nghiệp. Mỗi FR: migration → endpoint + RBAC → pytest → UI → thêm case vào `docs/test-cases.md`.
