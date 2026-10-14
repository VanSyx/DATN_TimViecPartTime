# Báo cáo tiến độ — Tuần 8 (FR8 email thật, gửi lại mã, quên mật khẩu, chuyển DB sang Neon)

Branch: `feat/week8-email` (PR #20), `docs/week8-fr8-prod` (PR #21), `feat/week8-resend-code` (PR #22), `feat/week8-forgot-password` (PR #23), `docs/week8-sync` (PR #24), `infra/neon-db` (PR #25), tất cả đã merge. `docs/neon-cutover` (setup-log #22, báo cáo này) chờ merge. Ảnh minh chứng: `docs/screenshots/week8/01..07`. Kiểm thử chi tiết: `docs/test-cases.md` mục 24–27.

## Đối chiếu kế hoạch (mục "Tiếp theo" của báo cáo Tuần 7)

| Hạng mục | Kết quả |
|---|---|
| Merge FR7/FR9, smoke test production | ✅ PR #17/#18, smoke test 9/9 |
| **FR8** gửi mã xác minh qua email thật | ✅ PR #20, đã lên production, PROD-10 đạt |
| Chuyển `timviec-db` sang DB mới trước 15/10 | ✅ Chuyển sang **Neon free** (không hết hạn), production đã chạy trên Neon, smoke test 9/9 |
| Bắt đầu viết báo cáo tốt nghiệp | ⏳ Chưa. Đã có báo cáo tuần 8 và tài liệu thiết kế cập nhật; chờ template của trường |
| *Ngoài kế hoạch:* gửi lại mã xác minh | ✅ PR #22 |
| *Ngoài kế hoạch:* quên mật khẩu | ✅ PR #23. Sót khi lập kế hoạch ban đầu, bổ sung vào `PROJECT_PLAN.md` mục 2.2 |

**Tất cả FR1–FR10 đã chạy trên production.** Definition of Done (`PROJECT_PLAN.md` mục 11) chỉ còn 2 mục: báo cáo tốt nghiệp và tập dượt demo.

## Chi tiết đã làm

**FR8: gửi mã xác minh qua email thật** (commit `ac1715a`):
- Gửi qua **HTTP API của Brevo** (gói Free, 300 email/ngày). Không dùng SMTP vì Render free chặn cổng 25/465/587 từ 26/09/2025.
- Không có `BREVO_API_KEY` (máy local, test) thì mã chỉ ghi log như Tuần 1–5. Có key thì không in mã ra log.
- Brevo lỗi chỉ ghi cảnh báo, đăng ký vẫn thành công: tài khoản chưa xác minh vẫn dùng được đầy đủ, đúng thiết kế từ Tuần 1.
- Chỉ làm email, không làm SMS (tốn phí).
- Cấu hình production: setup-log #18–19 (tạo sender, API key, biến môi trường trên Render).

**Gửi lại mã xác minh** (commit `121ad6e`):
- `POST /auth/resend-code` và nút "gửi lại mã" ở trang `/verify`. Mã mới đè mã cũ, mã cũ hết hiệu lực.
- Hai lớp chống spam: 3 lần/phút theo IP, và **60 giây theo tài khoản**. Giới hạn theo IP không chặn được việc spam 1 hộp thư từ nhiều IP.

**Quên mật khẩu** (commit `ab2c2e8`):
- `POST /auth/forgot-password` **luôn trả 204** dù email có tồn tại hay không, để không dò được email nào đã đăng ký. Dùng chung giới hạn 60s theo tài khoản với gửi lại mã.
- `POST /auth/reset-password`: **nhập sai mã 1 lần là huỷ mã**. Cộng với giới hạn 60s xin mã mới, kẻ tấn công chỉ dò được 1 mã/phút cho mỗi tài khoản dù đổi bao nhiêu IP (mã 6 số có 1 triệu khả năng).
- Đặt lại xong thì email coi như đã xác minh (nhận được mã qua email = chứng minh sở hữu email).
- Dùng lại cột `verification_code` có sẵn, không cần migration.
- Trang `/forgot-password` 2 bước (nhập email → nhập mã + mật khẩu mới) và link "Quên mật khẩu?" ở trang đăng nhập (`screenshots/week8/04-quen-mat-khau.png`).
- Hạn chế đã biết: refresh token cấp trước khi đổi mật khẩu vẫn dùng được tới khi hết hạn (7 ngày), vì token không lưu trạng thái. Ghi vào `PROJECT_PLAN.md` mục 2.2.

**Chuyển DB từ Render sang Neon** (PR #25, setup-log #20–22):
- Lý do: Postgres free của Render chỉ sống **30 ngày** (`timviec-db` hết hạn 15/10). Ngày bảo vệ là **30/12**, nên nếu ở lại Render free phải chuyển DB thêm 3 lần, còn nâng gói trả phí thì tốn ~$6/tháng.
- So sánh các phương án: Neon free, Render trả phí, Supabase free (tự tạm dừng sau 7 ngày không có truy vấn), VM Oracle Always Free (tự vận hành, rủi ro cao). Chọn **Neon free**: có PostGIS, không hết hạn, 0,5 GB (DB hiện tại 16 MB), cùng vùng AWS Oregon với backend.
- Các bước:
  1. `pg_dump` từ Render, `pg_restore` sang Neon.
  2. So số dòng, rồi so **checksum nội dung** từng bảng ở 2 DB: giống hệt.
  3. Chạy thử backend local trỏ vào Neon.
  4. Merge PR sửa `render.yaml` (bỏ `timviec-db`, `DATABASE_URL` đặt tay).
  5. Đổi `DATABASE_URL` trên Render.
  6. Xác nhận production ghi vào Neon: một thao tác ghi chỉ làm đổi dòng ở Neon.
  7. Smoke test **9/9**.
- Code không đổi. PostGIS trên Neon là 3.3 (Render là 3.6), nhưng app chỉ dùng `ST_DWithin`, `ST_Distance`, `ST_MakePoint`, `ST_SetSRID`, có sẵn từ PostGIS 2.
- Chi phí vận hành toàn hệ thống tới ngày bảo vệ: **$0** (Render free cho frontend/backend/AI, Neon free cho DB, Brevo free cho email).

**Đồng bộ tài liệu thiết kế** (PR #24): use case UC21 "Quên mật khẩu", sequence diagram cho gửi lại mã (mục 1) và quên mật khẩu (mục 2b), đánh dấu Definition of Done.

## Kiểm thử

| Lần chạy | Phạm vi | Kết quả |
|---|---|---|
| Trước merge FR8 | Mục 1–15 + 13b + 14b | **231/231** ngay lần 1; backend 60 |
| Sau merge FR8 | PROD-10 gửi email thật | Lần 1 lỗi cấu hình biến môi trường → sửa → **Đạt** |
| Trước merge gửi lại mã | Thêm VER-11, VER-12 | 232/233 (LOGIN-05 phụ thuộc thời gian, chạy lại đạt) → **233/233**; backend 61 |
| Sau merge gửi lại mã | PROD-11 | **Đạt**: 204 rồi 429, email tới hộp thư |
| Trước merge quên mật khẩu | Thêm LOGIN-14, 15, 16 | 235/236 (FORM-07 do dịch vụ định vị Photon bên ngoài chậm 15–19s, chạy lại đạt) → **236/236**; backend 62 |
| Sau merge quên mật khẩu | PROD-12 | **Đạt**: mật khẩu mới 200, mật khẩu cũ 401 |
| Sau khi chuyển DB sang Neon | PROD-01…09 | **9/9** |

Tổng bộ test case: **253/253** đạt (E2E 236, tự động 5 nhóm, production 12).

## Bug phát hiện khi kiểm thử

Không có lỗi ứng dụng mới. Hai lần lỗi trong bảng trên đều do yếu tố ngoài code:
- PROD-10: thiếu biến môi trường trên Render.
- FORM-07: dịch vụ định vị bên ngoài chậm.

LOGIN-05 vẫn là case bấp bênh do phải đợi 61 giây cho hết giới hạn đăng nhập.

## Việc phát sinh ngoài kế hoạch
- **Quên mật khẩu** bị sót khi lập kế hoạch ban đầu. Phát hiện khi rà soát Tuần 8, người thực hiện đồng ý bổ sung.
- **Chọn nhà cung cấp DB**: kế hoạch Tuần 7 là "chuyển sang DB free mới của Render". Khi chốt ngày bảo vệ 30/12 thì phương án đó phải chuyển 3 lần, nên đổi sang Neon.

## Chưa làm / rủi ro
- **`docs/neon-cutover` chưa merge** (chỉ tài liệu, an toàn).
- **Xoá `timviec-db` trên Render sau 15/10.** Tới lúc đó DB cũ là đường lui nếu Neon gặp sự cố.
- **Bảo mật:** đổi API key Brevo (từng hiện gần đủ trong 1 ảnh chụp màn hình; bản trong repo đã che).
- **Neon free tự ngủ** sau 5 phút rảnh (thức lại khoảng 1 giây). **Web service Render free ngủ** sau 15 phút, request đầu mất 30–60 giây, lần gợi ý đầu có thể rơi vào chế độ dự phòng. Trước buổi demo phải mở `/health` của backend và ai-service vài phút trước để đánh thức.
- Production còn các tài khoản test `qa-prod-*@example.org`, `syx140704+prod10/+prod11@gmail.com`, và 1 báo cáo test chờ admin "Bỏ qua".
- Vẫn chưa có template báo cáo của trường (`PROJECT_PLAN.md` mục 10). Người thực hiện sẽ gửi.

## Tiếp theo: Tuần 9
1. Nhận template báo cáo của trường, dựng khung chương theo đúng mẫu.
2. Viết các chương báo cáo tốt nghiệp. Nguyên liệu đã đủ: báo cáo tiến độ tuần 1–8, `docs/design/` (ERD, use case, sequence), `docs/test-cases.md`, `docs/setup-log.md` kèm ảnh, kết quả đánh giá AI offline.
3. Soạn kịch bản demo và phương án dự phòng (đánh thức service, tài khoản demo, xử lý khi mất mạng hoặc AI không phản hồi).
4. Sau 15/10: xoá `timviec-db` trên Render, ghi setup-log.
