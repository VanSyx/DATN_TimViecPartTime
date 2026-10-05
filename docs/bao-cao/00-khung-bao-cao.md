# Khung báo cáo đồ án tốt nghiệp (chọn lọc từ bộ biểu mẫu của Khoa)

Nguồn: `D:/DATN_backup/MAIN_BIEU MAU THUC HIEN DO AN TOT NGHIEP v3/` (Khoa CNTT, Trường ĐH Kiến trúc Đà Nẵng). Rà soát 2026-10-05.

## 1. Biểu mẫu nào dùng vào đâu

| File | Là gì | Sinh viên cần làm |
|---|---|---|
| `PL03_B_RuotThuyetMinh.docx` | **Mẫu ruột quyển báo cáo**: thứ tự các phần, định dạng | Dùng làm khung chính (mục 2, 3 bên dưới) |
| `PL02_A_BiaThuyetMinh.docx` | Bìa chính, bìa phụ, gáy sách | Điền tên đề tài, GVHD, họ tên, MSSV, lớp, "Đà Nẵng, …/2026" |
| `RUBRIC CHẤM ĐIỂM.pdf` | Cách chấm điểm (mục 4) | Quyết định nội dung nào phải có trong báo cáo, slide và demo |
| `BM02_De cuong CT.docx` | Mẫu đề cương | Chỉ nộp nếu Khoa yêu cầu. Lấy nội dung từ `PROJECT_PLAN.md` mục 1–2, 5. Mẫu này có quy định độ sâu mục **tối đa 4 cấp** (1.1.1.1) |
| `BM05`, `BM06` | Nhận xét của GVHD, GV phản biện | Giảng viên điền. Báo cáo chừa **2 trang trắng** ngay sau bìa để dán vào. BM05 có đếm số trang, chương, bảng, hình, tài liệu tham khảo |
| `BM07_Phieu cham DATN.xls` | Phiếu ghi điểm của hội đồng | Không cần làm gì |

## 2. Thứ tự các phần trong quyển (theo PL03)

1. Bìa chính, rồi bìa phụ (PL02)
2. Trang trắng: Nhận xét của GVHD
3. Trang trắng: Nhận xét của GV phản biện
4. **TÓM TẮT**: tối đa 1 trang. Đầu trang ghi tên đề tài, sinh viên, MSSV, lớp
5. **LỜI NÓI ĐẦU**, có thể gộp lời cảm ơn
6. **CAM ĐOAN** về liêm chính học thuật, kèm chữ ký và họ tên
7. **MỤC LỤC**
8. **DANH SÁCH CÁC BẢNG, HÌNH VẼ**
9. **DANH SÁCH CÁC KÝ HIỆU, CHỮ VIẾT TẮT**
10. **MỞ ĐẦU** (bắt đầu đánh số trang từ đây): mục đích, mục tiêu, phạm vi và đối tượng nghiên cứu, phương pháp nghiên cứu, cấu trúc đồ án
11. **Chương 1 … Chương N**
12. **KẾT LUẬN**: kết quả đạt được, đóng góp, đề xuất/kiến nghị
13. **TÀI LIỆU THAM KHẢO**
14. **PHỤ LỤC** (nếu có, cỡ chữ 12)

## 3. Quy định định dạng (checklist khi dàn trang Word)

- A4. Lề trái 3 cm, phải 2 cm, trên 2,5 cm, dưới 2,5 cm. Header/footer cách mép 1,6 cm.
- Nội dung: Times New Roman 13, giãn dòng 1,3, căn đều hai bên.
- Tiêu đề chương, MỞ ĐẦU, KẾT LUẬN, TÓM TẮT, TÀI LIỆU THAM KHẢO: 14, đậm, căn giữa, sau đó để 2 dòng trống.
- Mục (1.1): 13 đậm. Tiểu mục (1.1.1): 13 đậm nghiêng. Không sâu quá 4 cấp.
- Header: tên đề tài, nghiêng, cỡ 10, căn giữa. Footer: sinh viên thực hiện, GVHD, số trang, cỡ 10.
- Tên bảng **nằm trên** bảng, tên hình **nằm dưới** hình, căn giữa. Đánh số theo chương: Bảng 2.3, Hình 2.3. Bảng và hình đánh số riêng.
- Công thức đánh số bên phải, theo chương: (2.1).
- Dùng Heading, Caption, Cross-reference, mục lục tự động của Word ("Long Document").
- Tài liệu tham khảo chia **Tiếng Việt / Tiếng Anh**, dạng `[n] Tác giả (năm), "Tên bài", Nơi đăng, tập(số), tr./pp.`

## 4. Rubric quy ra nội dung cần có

Điểm = GVHD 20% + GV phản biện 20% + Hội đồng 60% (3 người × 20%).

| Người chấm | Tiêu chí | Trọng số | Mức A đòi hỏi | Thể hiện ở đâu trong đồ án |
|---|---|---|---|---|
| GVHD | Thái độ | 40% | Dự đủ buổi, đúng hạn, tự giải quyết vấn đề | Báo cáo tuần 1–8 (`docs/progress-reports/`) |
| GVHD | Tiến độ & quản lý dự án | 30% | Vượt tiến độ, **Git xuất sắc (commit rõ, branch hợp lý)**, kế hoạch chi tiết | **Mục 3.5**: kế hoạch 12 tuần, so sánh kế hoạch với thực tế, quy trình nhánh, PR, CI; số commit/PR |
| GVHD | Kỹ năng kỹ thuật | 30% | Best practices, **code có test**, tự gỡ lỗi, tài liệu đầy đủ | Chương 4 (kiểm thử), nhật ký lỗi, `docs/` |
| Phản biện | **Chất lượng báo cáo** | **50%** | Logic chặt, format chuẩn, phân tích kỹ, **tài liệu tham khảo uy tín** | Toàn quyển. TLTK dùng nguồn gốc: bài báo, RFC, tài liệu chính thức |
| Phản biện | Tính khả thi & ứng dụng | 30% | Bài toán thực tế rõ, **người dùng mục tiêu cụ thể**, triển khai thực tế được | Mở đầu, 1.1, 3.4 (đang chạy production, chi phí $0) |
| Phản biện | Độ phức tạp kỹ thuật | 20% | **AI/ML, Cloud, Microservices**, giải quyết vấn đề khó | 1.2, 2.3, 2.6, 3.2.5: AI service tách riêng, chấm điểm 4 thành phần có giải thích, PostGIS, triển khai đám mây |
| Hội đồng | Thuyết trình | 40% | Slide chuyên nghiệp, đúng giờ | Làm sau (slide) |
| Hội đồng | **Demo** | 35% | Chạy không lỗi, **có kịch bản, có phương án dự phòng** | Kịch bản demo (mục DoD còn mở) |
| Hội đồng | Trả lời câu hỏi | 25% | **Giải thích được các quyết định kỹ thuật** | Mỗi quyết định trong báo cáo ghi rõ "vì sao", cùng phương án đã loại |

## 5. Dàn ý đề xuất

Mẫu PL03 để KẾT LUẬN ngoài các chương nên đồ án dùng 4 chương. Cột "Nguồn" là tài liệu có sẵn để viết từ đó.

**MỞ ĐẦU**: mục đích; mục tiêu; đối tượng và phạm vi (gồm phần ngoài phạm vi: chat realtime, thanh toán, CF, giao diện điện thoại, SMS); phương pháp (khảo sát, phát triển lặp theo tuần, kiểm thử tự động, đánh giá offline); cấu trúc đồ án. Nguồn: `PROJECT_PLAN.md` mục 1–2.

| Chương | Mục | Nguồn |
|---|---|---|
| **1. Tổng quan và cơ sở lý thuyết** | 1.1 Bài toán việc làm bán thời gian theo giờ; khảo sát hệ thống hiện có (TopCV, VietnamWorks, bTaskee) và khoảng trống: không khớp theo giờ rảnh và vị trí | `PROJECT_PLAN.md` mục 1, brief UI |
| | 1.2 Hệ gợi ý: content-based và collaborative filtering (lý do không dùng CF); TF-IDF và cosine; khả thi thời gian; khoảng cách địa lý; độ uy tín; gợi ý có giải thích (explainable) | `.claude/docs/ai_scoring.md` |
| | 1.3 Công nghệ: React + Vite + Tailwind, FastAPI, PostgreSQL + PostGIS, JWT/bcrypt, Docker, GitHub Actions, Render, Neon, Brevo. Mỗi công nghệ nêu **lý do chọn** | `PROJECT_PLAN.md` 4.2, `architecture.md` |
| **2. Phân tích và thiết kế** | 2.1 Yêu cầu chức năng FR1–FR10 (+ quên mật khẩu), phi chức năng | `PROJECT_PLAN.md` 3 |
| | 2.2 Use case: sơ đồ + đặc tả các use case chính | `docs/design/use-case.md` |
| | 2.3 Kiến trúc: frontend ↔ backend ↔ AI service, sơ đồ triển khai | `architecture.md`, `render.yaml` |
| | 2.4 Cơ sở dữ liệu: ERD, mô tả bảng | `docs/design/erd.md`, `database.md` |
| | 2.5 Biểu đồ tuần tự các luồng chính | `docs/design/sequence-diagram.md` |
| | 2.6 Thiết kế thuật toán gợi ý: công thức `final_score` (đánh số công thức), chuẩn hoá, trọng số, dự phòng khi AI không phản hồi | `ai_scoring.md` |
| | 2.7 Thiết kế giao diện S0–S12 | `docs/design/ui-redesign-brief.md`, mockups |
| | 2.8 Thiết kế bảo mật: RBAC, rate limit, mã xác minh băm, chống dò email/mã | `security.md` |
| **3. Cài đặt và triển khai** | 3.1 Môi trường, công cụ, cấu trúc mã nguồn (monorepo) | `CLAUDE.md`, setup-log |
| | 3.2 Cài đặt từng phân hệ: xác thực + email; tin đăng + tìm theo vị trí; ứng tuyển; AI service; đánh giá/uy tín; báo cáo vi phạm/quản trị/thông báo | báo cáo tuần 2–8 |
| | 3.3 Kết quả giao diện (ảnh chụp các màn chính) | `docs/screenshots/week6..8` |
| | 3.4 Triển khai production: Render, Neon, CI/CD, biến môi trường, chi phí | `setup-log.md` #1–22 + ảnh |
| | 3.5 Quản lý dự án: kế hoạch 12 tuần, so với thực tế, quy trình Git/PR | `PROJECT_PLAN.md` 5–6, git log |
| **4. Kiểm thử và đánh giá** | 4.1 Chiến lược kiểm thử | `PROJECT_PLAN.md` 7 |
| | 4.2 Kiểm thử tự động: backend 62, ai-service 22 | `test-cases.md` mục 16 |
| | 4.3 Kiểm thử hệ thống E2E 236 case + smoke test production | `test-cases.md` |
| | 4.4 Lỗi phát hiện và cách xử lý | `test-cases.md` mục 18–27, báo cáo tuần |
| | 4.5 Đánh giá AI offline: P@k, R@k, NDCG@k so với baseline; nêu rõ giới hạn (dữ liệu mô phỏng, cùng người gán nhãn) | `ai_scoring.md`, `backend/offline_eval.py` |
| | 4.6 Đánh giá yêu cầu phi chức năng, hạn chế còn lại | báo cáo tuần 8 |

**KẾT LUẬN**: kết quả; đóng góp; hạn chế (không pilot test thật, TF-IDF chỉ khớp đúng chữ, không realtime, chỉ desktop, refresh token sống 7 ngày, dịch vụ free ngủ khi rảnh); hướng phát triển.

**PHỤ LỤC** (đề xuất): 1. Danh sách API; 2. Tổng hợp test case; 3. Hướng dẫn cài đặt và triển khai.

## 6. Còn thiếu từ phía sinh viên

- MSSV, lớp, khoá (cho bìa và trang Tóm tắt).
- Đề cương BM02 đã nộp chưa (nếu Khoa yêu cầu).
- Số trang tối thiểu/tối đa nếu Khoa có quy định riêng (biểu mẫu không ghi).
