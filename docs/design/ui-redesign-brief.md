# Brief thiết kế lại giao diện — TimViecPartTime

Soạn 2026-09-24. Tài liệu này dùng để giao cho agent/người thiết kế vẽ **mockup ảnh / Figma**. Sau khi mockup được duyệt, frontend sẽ được code lại bằng **React (Vite) + TailwindCSS** (stack đã chốt ở `docs/PROJECT_PLAN.md` mục 4.2), nên màu, chữ và kích thước nên bám theo thang của Tailwind (mục 3).

**Giao diện hiện tại** (chỉ để tham khảo, không phải hướng mới): `docs/screenshots/week5/`. Nên xem `01-recommend-ai-breakdown.png` (trang gợi ý), `05-employer-form-dang-tin.png` (form đăng tin) và `07-seeker-mo-ta-lich-ranh.png` (lịch rảnh).

---

## 1. Sản phẩm trong 30 giây

Web kết nối **người tìm việc part-time dạng helper** (dọn nhà, trông trẻ, nấu ăn, phụ quán, chăm người già…) với **hộ gia đình / cơ sở nhỏ** cần người theo giờ. Điểm khác biệt: **AI gợi ý việc theo giờ rảnh thật + khoảng cách + mức khớp mô tả, và giải thích vì sao gợi ý**. Ngôn ngữ: tiếng Việt, xưng "bạn". Tên sản phẩm: **TimViecPartTime**. Có thể đề xuất 1-2 phương án logo chữ, nhưng giữ nguyên tên này.

**Ba vai trò**: người tìm việc (job seeker), người đăng tin (employer), quản trị viên (admin).

**Nhân vật tham chiếu** (lấy từ dữ liệu mẫu):
- **Lan**, sinh viên năm 2, rảnh các buổi chiều trong tuần và cả ngày cuối tuần, dùng điện thoại.
- **Cô Hòa**, 52 tuổi, đã nghỉ hưu, không làm buổi tối, không đi xa quá 5 km, cần chữ to và thao tác đơn giản.
- **Anh Hùng**, tài xế xe ôm công nghệ, chỉ rảnh 5h30–10h sáng.
- **Chị Hương** (chủ nhà 3 tầng, có mèo) và **anh Tuấn** (quán cafe nhỏ, đăng lẻ từng ca): người đăng tin.

## 2. Nguyên tắc thiết kế

1. **Tin cậy trước tiên**: người lạ đến làm tại nhà, nên giao diện phải sạch, rõ ràng, trạng thái minh bạch, không dùng dark pattern.
2. **Thời gian là trung tâm**: giờ làm và giờ rảnh phải nhìn là hiểu ngay (dạng timeline/khối giờ, không phải chuỗi ngày giờ dài).
3. **AI giải thích bằng lời**: mỗi gợi ý có 3–4 lý do ngắn kèm icon. Số liệu chi tiết nằm trong phần "Xem cách tính điểm".
4. **Thiết kế cho điện thoại trước**: bấm được bằng một ngón cái, vùng chạm ≥ 44px, ô nhập chữ ≥ 16px. Desktop vẫn phải đẹp vì buổi demo trước hội đồng chạy trên laptop.
5. **Thân thiện với người lớn tuổi**: chữ thân ≥ 16px, độ tương phản WCAG AA, trạng thái luôn có **chữ + icon** (không chỉ phân biệt bằng màu).

## 3. Hệ thống thiết kế (khớp thang Tailwind)

**Phong cách: ấm áp, gần gũi.**

- **Màu** (tên palette mặc định của Tailwind):
  - Primary: `teal-600 #0D9488` (hover `teal-700 #0F766E`), nền nhạt `teal-50`.
  - Accent / CTA chính (Ứng tuyển, Đăng tin): `orange-500 #F97316` (hover `orange-600`).
  - Nền trang `stone-50 #FAFAF9`, bề mặt thẻ trắng, viền `stone-200`, chữ chính `stone-900`, chữ phụ `stone-500`.
  - Trạng thái: thành công `green-600`, cảnh báo `amber-500` (nền `amber-50`), lỗi `red-600`, thông tin `sky-600`.
  - Dark mode: không bắt buộc. Nếu vẽ thì chỉ 1-2 màn (nền `stone-900`, bề mặt `stone-800`).
- **Font**: **Be Vietnam Pro** (Google Fonts, thiết kế riêng cho tiếng Việt). Cỡ chữ 14 / 16 (thân) / 18 / 20 / 24 / 30. Tiêu đề semibold, thân regular.
- **Bo góc** 12px cho thẻ, 10px cho nút/ô nhập, bo tròn hẳn cho badge/chip. **Bóng đổ** mềm, 1 cấp (`shadow-sm`, khi hover `shadow-md`). **Lưới** 4px. Nội dung desktop rộng tối đa 1120px.
- **Icon**: nét outline 1.5px, kiểu Lucide. **Minh hoạ**: phẳng, người thật làm việc nhà, tông teal/cam, dùng cho trang giới thiệu và empty state.

## 4. Component dùng chung (vẽ thành 1 trang component sheet)

- **Button**: primary (cam), secondary (viền teal), ghost, danger; có trạng thái loading và disabled.
- **Input, Textarea, Select**, ô **OTP 6 số**.
- **Badge trạng thái đơn**: Chờ duyệt / Đã nhận / Bị từ chối / Đã hủy. **Badge trạng thái tin**: Đang mở / Đã đóng / Chờ duyệt / Bị từ chối.
- **JobCard**: bản gọn cho danh sách và bản đầy đủ khi mở ra.
- **MatchScore**: vòng tròn %.
- **ScoreBreakdown**: lý do bằng lời, cộng phần mở rộng có 4 thanh điểm và công thức `35% mô tả + 35% giờ rảnh + 20% khoảng cách + 10% tin cậy`.
- **LocationPicker**: ô địa chỉ, nút "Định vị trên bản đồ", nút "Dùng vị trí hiện tại", **danh sách kết quả để chọn**, bản đồ có ghim kéo được, dòng toạ độ đã chọn.
- **AvailabilityEditor**: xem màn S7.
- **Banner** (thông tin / cảnh báo / AI dự phòng), **Toast**, **EmptyState**, **Skeleton loading**.
- **AppShell**: trên điện thoại là thanh tab dưới, trên desktop là thanh trên. Chừa chỗ cho chuông thông báo (W2).
- **Bottom sheet** (điện thoại) / **Modal** (desktop).

## 5. Màn hình, vẽ chi tiết

Mỗi màn vẽ 2 kích thước: **điện thoại 390×844** và **desktop 1440×900**.

| # | Màn hình | Nội dung bắt buộc | Trạng thái cần vẽ |
|---|---|---|---|
| S0 | Trang giới thiệu *(đề xuất mới: chỉ là trình bày, không thêm tính năng)* | Hero "Việc làm thêm vừa với giờ rảnh của bạn", 3 bước (Khai giờ rảnh → AI gợi ý → Ứng tuyển), khối giải thích AI, CTA cho 2 vai trò | — |
| S1 | Đăng nhập | Email, mật khẩu, link đăng ký | Sai mật khẩu; bị chặn tạm vì "quá nhiều lần thử" |
| S2 | Đăng ký | Chọn vai trò bằng **2 thẻ lớn** (Tìm việc / Tuyển người), email, mật khẩu ≥ 8 ký tự, SĐT (tuỳ chọn) | Email đã tồn tại |
| S3 | Xác minh email | 6 ô OTP, link "Để sau, đăng nhập luôn" (chưa xác minh vẫn đăng nhập được) | Thành công; mã sai hoặc hết hạn |
| S4 | **Gợi ý cho tôi** (màn quan trọng nhất, nên là trang chủ của người tìm việc) | Chọn vị trí + bán kính (sau lần đầu thì thu gọn thành 1 dòng), danh sách JobCard có MatchScore + 3–4 lý do + nút Ứng tuyển | Đang tải (skeleton); **nhắc khai hồ sơ** khi thiếu mô tả hoặc lịch rảnh sắp tới; **banner AI dự phòng** ("AI tạm thời không phản hồi — đang xếp theo khoảng cách", không có breakdown); không có việc trong bán kính; đã ứng tuyển; lỗi "Bạn đã ứng tuyển việc này" |
| S5 | Tìm việc | Bộ lọc: vị trí, bán kính, khung giờ; **chuyển qua lại giữa Danh sách và Bản đồ** (ghim các việc trên bản đồ) | Không có kết quả; đang tải |
| S6 | Chi tiết việc (bottom sheet / modal, chỉ dùng dữ liệu đã có) | Tiêu đề, địa chỉ + bản đồ nhỏ, ngày giờ, tiền công, mô tả đầy đủ, breakdown (khi mở từ S4), nút Ứng tuyển | Tin đã kết thúc → không cho ứng tuyển |
| S7 | Hồ sơ & lịch rảnh | Mô tả bản thân (kèm gợi ý cách viết). **Lịch rảnh dạng timeline theo ngày**: các khối giờ trên trục 0–24h. Thêm khoảng rảnh qua sheet: chọn ngày + giờ bắt đầu/kết thúc, có nút nhanh "Sáng 7–11 / Chiều 13–17 / Tối 18–21" chỉ để điền sẵn giờ. Xoá khoảng rảnh | Chưa khai gì (empty state có hướng dẫn); đã lưu |
| S8 | Đơn ứng tuyển của tôi | Tab theo trạng thái (Tất cả / Chờ duyệt / Đã nhận / Khác), JobCard + badge, nút Hủy đơn khi đơn đang chờ | Chưa có đơn |
| S9 | Người đăng tin: Tin đã đăng | Nút "Đăng tin mới" nổi bật; danh sách tin kèm badge trạng thái và các nút Sửa / Đóng tin / Xem đơn | Chưa có tin (empty state) |
| S10 | Người đăng tin: Đăng / Sửa tin | Điện thoại: form 3 bước **Công việc** → **Địa điểm** (số nhà + đường / phường-xã / tỉnh-thành phố + LocationPicker) → **Thời gian & tiền công**. Desktop: 1 trang 2 cột kèm xem trước JobCard | Chưa ghim vị trí; giờ kết thúc trước giờ bắt đầu |
| S11 | Người đăng tin: Đơn ứng tuyển của 1 tin | Mỗi ứng viên: avatar là chữ cái đầu của email, email, SĐT (bấm để gọi), badge, nút Nhận / Từ chối | Chưa có ai ứng tuyển; đơn đã được xử lý |
| S12 | Quản trị | Khung trang quản trị (placeholder, nội dung xem W4) | — |

## 6. Màn tuần 6-12, chỉ phác wireframe (không tô màu chi tiết)

Những chức năng này chưa làm. Vẽ trước để hệ thống thiết kế dùng được về sau.

- **W1 Đánh giá sau công việc**: 1–5 sao + nhận xét, cho cả 2 chiều. Kèm chỗ hiển thị sao trên JobCard và trên thẻ ứng viên.
- **W2 Thông báo in-app**: chuông trên header có số chưa đọc, và danh sách thông báo (đơn được nhận/từ chối, có người ứng tuyển).
- **W3 Báo cáo / chặn người dùng**: menu "⋯" trên thẻ mở ra modal chọn lý do.
- **W4 Quản trị**: duyệt tin (`Chờ duyệt` → Duyệt / Từ chối), danh sách người dùng với Khoá / Mở khoá, danh sách báo cáo vi phạm.

## 7. Ràng buộc bắt buộc (không được vi phạm)

- **Không vẽ dữ liệu không tồn tại như thể có thật**: tên người, ảnh đại diện thật, ảnh công việc, danh mục/ngành nghề, bộ lọc theo ngành, số lượt xem, số đơn trên mỗi tin. Người dùng được định danh bằng email (+ SĐT), avatar là chữ cái đầu. Nếu muốn thêm trường nào, ghi chú **"cần thêm dữ liệu"** để xác nhận sau.
- **Không có**: chat, thanh toán, CV builder, lịch lặp hàng tuần (lịch rảnh là các khoảng **theo ngày cụ thể**), gợi ý "khẩn cấp" real-time.
- Lịch rảnh là **khoảng thời gian tự do** (vd 07:15–11:40), **không** gom về ca cố định Sáng/Chiều/Tối. Nút nhanh chỉ để điền sẵn giờ.
- **Luôn hiện lý do gợi ý** (explainable AI). Trạng thái AI dự phòng phải trông khác hẳn: không có vòng %, chỉ có khoảng cách, kèm banner.
- Độ tin cậy hiện là **"Chưa có đánh giá"** (trung lập). Không vẽ sao cho tới W1.
- **Bản đồ**: OpenStreetMap qua Leaflet, **không đổi được style nền bản đồ** (không dùng Mapbox/Google Maps). Chỉ tuỳ biến được ghim, popup và khung bao. Tra địa chỉ trả về **danh sách kết quả để người dùng tự chọn** (chỉ chính xác tới mức tên đường), toạ độ cuối cùng do người dùng xác nhận bằng ghim.
- Địa chỉ theo **2 cấp hành chính** (từ 1/7/2025): số nhà + đường / phường-xã / tỉnh-thành phố. **Không có quận/huyện.**
- Một tin = **1 khung giờ liền trong 1 ngày**. Tiền công tính **cho cả buổi**, đơn vị VND.

## 8. Quy ước nội dung

- Ngày giờ: `T7, 26/09 · 08:00–11:00`. Tiền: `250.000 đ`. Khoảng cách dùng dấu phẩy thập phân: `cách 0,5 km · ~2 phút đi lại`.
- Ví dụ lý do gợi ý:
  - "✓ Nằm trọn trong giờ rảnh của bạn (đã tính 2 phút đi lại)", hoặc "✗ Ngoài giờ rảnh của bạn"
  - "📍 Cách bạn 0,5 km"
  - "📝 Khớp một phần với mô tả của bạn"
  - "⭐ Chưa có đánh giá"
- Chữ hiển thị cho "Khớp mô tả" theo ngưỡng **tạm thời** (AI bản hiện tại cho điểm mô tả thấp): ≥ 30% "Khớp tốt", 10–30% "Có liên quan", < 10% "Ít liên quan". Ngưỡng sẽ chỉnh lại khi nâng cấp AI ở tuần 6.
- Dữ liệu mẫu cho mockup (số liệu thật từ bản chạy thử):

  | Việc | Điểm | Khớp mô tả | Giờ rảnh | Khoảng cách |
  |---|---|---|---|---|
  | Dọn dẹp nhà cửa sáng thứ 7 · 06 Phan Huy Ôn, Phường Hải Châu, Đà Nẵng · T7 26/09 08:00–11:00 · 250.000 đ | 83% | 55% | 100% | 0,51 km |
  | Trông 2 bé chiều thứ 7 · 88 Phan Châu Trinh, Phường Hải Châu, Đà Nẵng · T7 26/09 13:30–18:00 · 320.000 đ | 29% | 2% | 0% | 0,78 km |
  | Phụ bếp, rửa bát tiệc cưới trưa CN · 32 Hàng Bạc, Phường Hoàn Kiếm, Hà Nội · CN 27/09 09:30–15:00 · 350.000 đ | 65% | 4% | 100% | 0,63 km |

## 9. Sản phẩm cần giao

1. Trang **design tokens** (màu, chữ, bo góc, bóng) và **component sheet** (mục 4).
2. S0–S12, mỗi màn 2 kích thước (390×844 và 1440×900), kèm các trạng thái ở cột "Trạng thái cần vẽ" của mục 5.
3. Wireframe W1–W4.
4. 2 luồng dạng chuỗi màn:
   - **Người tìm việc**: đăng ký → khai hồ sơ → gợi ý → ứng tuyển → thấy "Đã nhận".
   - **Người đăng tin**: đăng tin → xem đơn → nhận.
5. Đặt tên file theo `docs/design/mockups/<mã màn>-<mobile|desktop>[-<trạng thái>].png`, ví dụ `S4-mobile-fallback.png` (xem `docs/design/mockups/README.md`).

## 10. Prompt mẫu để giao cho agent thiết kế

> Bạn là product designer. Đọc toàn bộ `docs/design/ui-redesign-brief.md` và thiết kế mockup theo đúng mục 3–9. Tuân thủ tuyệt đối mục 7 (ràng buộc về dữ liệu và bản đồ). Phong cách ấm áp, gần gũi, teal + cam, font Be Vietnam Pro, thiết kế cho điện thoại trước. Màn quan trọng nhất là S4 "Gợi ý cho tôi": phần giải thích AI phải dễ hiểu và nổi bật. Dùng dữ liệu mẫu ở mục 8, toàn bộ chữ bằng tiếng Việt.
