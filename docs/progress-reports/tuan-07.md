# Báo cáo tiến độ — Tuần 7 (FR6 đánh giá, FR10 quản trị, FR7 báo cáo vi phạm, FR9 thông báo)

Branch: `feat/week7-rating` (PR #15, đã merge), `feat/week7-admin` (PR #16, đã merge `5e26f1d`), `feat/week7-report-notif` (2 commit, **chờ merge**). Ảnh minh chứng: `docs/screenshots/week7/`. Kiểm thử chi tiết: `docs/test-cases.md` mục 21–23.

## Đối chiếu kế hoạch (`PROJECT_PLAN.md` mục 5.2, thứ tự đã chốt cuối Tuần 6)

| Hạng mục | Kết quả |
|---|---|
| **FR6** đánh giá hai chiều, thay `trust = 1.0` | ✅ PR #15, đã lên production, smoke test 8/8 |
| **FR10** admin gỡ/khôi phục tin, khoá/mở khoá tài khoản | ✅ PR #16, đã lên production, smoke test 8/8 |
| **FR7** báo cáo vi phạm + admin xử lý | ✅ Code xong, E2E đạt, **chờ merge** |
| **FR9** thông báo in-app | ✅ Code xong cùng FR7, **chờ merge** |
| **FR8** gửi mã xác minh thật | ⏳ Dời sang Tuần 8 (đúng thứ tự đã định: làm cuối) |

## Chi tiết đã làm

**FR6 — đánh giá hai chiều** (commit `31cb90b`):
- Bảng `ratings`, điểm 1–5, `UNIQUE(application_id, rater_id)` để mỗi bên chỉ đánh giá 1 lần cho 1 đơn.
- Chỉ 2 bên của đơn **đã được nhận** và công việc **đã kết thúc** mới được đánh giá; người bị đánh giá suy ra từ đơn, client không tự chọn được.
- Gợi ý việc: backend gửi điểm trung bình của người đăng tin sang ai-service, `trust = (avg − 1) / 4`; chưa có đánh giá giữ `trust = 1.0` (không phạt người mới). Lý do gợi ý hiện thêm "Người đăng tin: x ★".

**FR10 — quản trị** (commit `a91d8fa`, `3967085`):
- Router `/admin` chặn quyền ở mức router (`require_role(ADMIN)`).
- **Quyết định 2026-10-02**: tin đăng hiện ngay, admin gỡ sau (không duyệt trước) — tránh tin của người đăng phải chờ khi chỉ có 1 admin. Gỡ/khôi phục dùng `UPDATE` có điều kiện, sai trạng thái trả 409; không mở lại tin người đăng tự đóng.
- Khoá tài khoản có hiệu lực ngay ở request kế tiếp; tin của người bị khoá ẩn khỏi tìm kiếm/gợi ý và không nhận đơn mới; không khoá được admin.
- Admin production tạo bằng SQL (API đăng ký không cho chọn vai trò admin để chống tự nâng quyền) — setup-log #17.

**FR7 — báo cáo vi phạm** (commit `6d03a33`):
- **Quyết định 2026-10-04**: "block" trong FR7 = admin khoá tài khoản (dùng lại cờ `is_blocked` của FR10), không làm chặn giữa 2 người dùng. Bám ERD và sequence diagram #9.
- Người tìm việc và người đăng tin báo cáo nhau (từ chi tiết tin và danh sách người ứng tuyển); mỗi cặp chỉ có 1 báo cáo đang chờ.
- Admin xem báo cáo, **bỏ qua** hoặc **khoá** người bị báo cáo; khoá thì đóng luôn các báo cáo đang chờ khác về người đó.

**FR9 — thông báo in-app** (commit `6d03a33`):
- Thông báo sinh **trong cùng transaction** với sự kiện, nên không có trường hợp sự kiện xảy ra mà mất thông báo: đơn mới, đơn được nhận/từ chối, tin bị gỡ (kèm lý do admin nhập)/khôi phục, kết quả xử lý báo cáo.
- Chuông trên header, tải lại khi chuyển trang. **Không realtime** (không WebSocket/polling) — đủ cho phạm vi đồ án, ghi vào giới hạn.

## Kiểm thử

| Lần chạy | Phạm vi | Kết quả |
|---|---|---|
| 2026-10-03, trước merge FR6 | Mục 1–15 + 13b | 206/210 → sửa → **210/210**; backend 46, ai-service 22 |
| 2026-10-03, sau merge FR6 | Production mục 17 (thêm PROD-08) | **8/8** |
| 2026-10-03, trước merge FR10 | Mục 1–15 + 13b, mục 14 viết lại 10 case | 217/218 → sửa case → **218/218**; backend 54 |
| 2026-10-05, sau merge FR10 | Production mục 17, `/admin/*` trả 401 khi chưa đăng nhập | **8/8** |
| 2026-10-05, trước merge FR7+FR9 | Mục 1–15 + 13b + 14b (13 case mới) | 225/231 → sửa script/case → **231/231**; backend 59, build, lint 0 lỗi |

Tổng bộ test case hiện có **245** case (thêm PROD-09 cho FR7/FR9, chạy sau khi merge).

## Bug phát hiện khi kiểm thử

| Bug | Mức | Mô tả | Xử lý |
|---|---|---|---|
| #4 UI-02/06/09 | Thấp | Console báo trùng `key` ở thanh giờ khi seeker có 2 khoảng rảnh cùng giờ bắt đầu. Có từ Tuần 6, chỉ lộ khi "ngày mai" rơi vào ngày có 2 khoảng chồng nhau | `key` theo `id` khoảng rảnh |

Các lần lỗi khác trong bảng trên đều do script/case chưa cập nhật theo thay đổi có chủ đích (nhãn "Bị từ chối" → "Bị gỡ", chuông thông báo đứng trước menu tài khoản, nút báo cáo luôn hiện), không phải lỗi ứng dụng. Lỗi tự phát hiện trong lúc code FR7/FR9: `seed.py` chưa xoá `reports`/`notifications` trước `users` (lỗi khoá ngoại khi seed lại); chuông làm menu tràn — đã sửa trước khi chạy suite.

## Việc phát sinh ngoài kế hoạch
- **`timviec-db` (free) hết hạn 2026-10-15** (banner trên dashboard Render, thấy 2026-10-05). Đã `pg_dump` bản sao lưu ngày 2026-10-05 (lưu ngoài repo, có dữ liệu người dùng). Quyết định: **chuyển sang DB mới**, làm trước 2026-10-15 — dump lại ngay trước khi đổi `DATABASE_URL`.
- URL kết nối DB production (có mật khẩu) bị lộ trong lúc tạo admin → cần đổi mật khẩu và gỡ `0.0.0.0/0` khỏi Access Control. Việc chuyển DB mới cũng giải quyết luôn mật khẩu cũ.

## Chưa làm / rủi ro
- **`feat/week7-report-notif` chưa merge** — merge = deploy production; sau merge chạy PROD-09 rồi admin bỏ qua báo cáo test trên `/admin/reports`.
- **Chuyển DB trước 2026-10-15.** Render có thể chỉ cho 1 DB free mỗi workspace (phải xoá DB cũ trước khi tạo mới → web ngừng khoảng 10–15 phút), và DB free mới lại hết hạn sau 30 ngày — cần so với lịch bảo vệ.
- Setup-log #17 còn thiếu 2 ảnh `week7/08-sql-cap-quyen-admin.png`, `09-admin-production.png`.
- Production còn các tài khoản `qa-prod-*@example.org` của smoke test (chưa có API xoá tài khoản).
- Thông báo không realtime; báo cáo không có bằng chứng đính kèm (chỉ lý do dạng chữ).
- Vẫn chưa có template báo cáo của trường (`PROJECT_PLAN.md` mục 10).

## Tiếp theo: Tuần 8
1. Merge FR7/FR9, smoke test production 9/9.
2. Chuyển `timviec-db` sang DB mới (trước 2026-10-15), ghi setup-log kèm ảnh.
3. **FR8** gửi mã xác minh qua email thật (thay ghi log), giữ nguyên luồng xác minh đã có.
4. Bắt đầu viết các chương báo cáo tốt nghiệp xen kẽ ngày code.
