# AI Scoring

## Công thức
```
final_score = w1 × semantic_score + w2 × time_feasibility_score + w3 × geo_score + w4 × trust_modifier
```
Tất cả 4 thành phần nằm trong [0,1] **trước khi** nhân trọng số. Chuẩn hóa theo **cận cố định**, không min-max theo từng lô job: min-max theo lô làm điểm một job phụ thuộc các job khác trong cùng lô, và lô 1 job thì chia cho 0.

Cài đặt: `ai-service/app/scoring.py` (hàm thuần, không state) + `ai-service/app/main.py` (`POST /score`). Trọng số hiện tại (tuần 4): `semantic 0.35, time_feasibility 0.35, geo 0.2, trust 0.1` — chọn tay, hiệu chỉnh bằng đánh giá offline trước mốc khóa tuần 6.

## Từng thành phần
- **semantic_score** — so khớp ngữ nghĩa mô tả job (`title + description`) vs. mô tả tự do của người tìm việc (`users.description`).
  - Tuần 1-5: TF-IDF + cosine similarity, tự cài bằng thư viện chuẩn Python (không scikit-learn). Token = âm tiết + bigram âm tiết (từ tiếng Việt thường 2 âm tiết: "dọn dẹp", "trông trẻ"), chuẩn hóa Unicode NFC + chữ thường. IDF dạng smooth `ln((1+n)/(1+df)) + 1`, tính trên chính lô job của request (AI service không giữ state). Cosine của vector không âm nên tự nằm trong [0,1]. Mô tả trống → 0 cho mọi job (không đổi thứ hạng).
  - Tuần 6+: nâng cấp `sentence-transformers` + pgvector. **Thiết kế thuật toán bị khóa sau tuần 6 — không đổi kiến trúc scoring sau mốc này** (để khớp với chương báo cáo đã viết).
- **time_feasibility_score** — tỉ lệ khung cần có mặt `[giờ bắt đầu − thời gian đi, giờ kết thúc + thời gian về]` nằm trong **hợp** các `availability_intervals` (gộp interval chồng nhau trước, không đếm trùng). Thời gian đi = khoảng cách Haversine / 20 km/h (xe máy nội thành, hằng số). 1 = rảnh trọn cả đi lẫn về, 0 = không rảnh chút nào.
- **geo_score** — `1 − min(d, R)/R`, với `d` = khoảng cách Haversine, `R` = bán kính tìm kiếm (min-max cận cố định [0, R]). Dùng Haversine thay vì `ST_Distance` của PostGIS để AI service không phụ thuộc DB; sai khác với khoảng cách geography của PostGIS < 0.5%, không đáng kể ở bán kính ≤ 100 km. PostGIS vẫn dùng ở backend để **lọc trước** job ứng viên (`ST_DWithin`).
- **trust_modifier** — dựa trên rating hai chiều. **Mặc định 1.0 (trung lập) khi chưa có dữ liệu rating** — không được để giá trị mặc định làm lệch điểm gợi ý theo hướng cao/thấp bất thường. Tuần 4-5 mọi job đều 1.0 nên chỉ cộng hằng số `w4`, không đổi thứ hạng.

## Vì sao không dùng Collaborative Filtering
Dữ liệu tương tác quá thưa và vòng đời job ngắn trong phạm vi đồ án — không đủ điều kiện chứng minh CF hoạt động đúng. Đây là quyết định kiến trúc đã chốt, **không triển khai CF** dù có ý tưởng cải tiến sau này.

## Explainable AI
Endpoint gợi ý AI **bắt buộc trả breakdown từng thành phần điểm**, không chỉ 1 số `final_score` — mọi kết quả gợi ý phải giải thích được lý do trên UI.

## Đánh giá offline
Precision@k, Recall@k, NDCG@k so với baseline (sort theo thời gian đăng / lọc cứng không xếp hạng). Dữ liệu dùng để đánh giá chủ yếu là seed/mô phỏng (không đủ thời gian pilot test thật trong 5 tuần đầu) — **phải minh bạch giới hạn này khi viết báo cáo**, tránh kết luận mang tính circular.

## Nguồn tham khảo
Chi tiết đầy đủ: `docs/PROJECT_PLAN.md` mục 1.3, 3.3, 7, 8.
