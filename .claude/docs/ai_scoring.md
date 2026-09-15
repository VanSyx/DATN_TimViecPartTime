# AI Scoring

## Công thức
```
final_score = w1 × semantic_score + w2 × time_feasibility_score + w3 × geo_score + w4 × trust_modifier
```
Tất cả 4 thành phần chuẩn hóa về [0,1] (min-max) **trước khi** nhân trọng số.

## Từng thành phần
- **semantic_score** — so khớp ngữ nghĩa mô tả job vs. nhu cầu người tìm việc.
  - Tuần 1-5: TF-IDF + cosine similarity.
  - Tuần 6+: nâng cấp `sentence-transformers` + pgvector. **Thiết kế thuật toán bị khóa sau tuần 6 — không đổi kiến trúc scoring sau mốc này** (để khớp với chương báo cáo đã viết).
- **time_feasibility_score** — độ chồng lấp (overlap) giữa `availability_intervals` của job seeker và khung giờ job cần, có trừ thời gian di chuyển ước lượng bằng Haversine distance.
- **geo_score** — khoảng cách địa lý, tính qua PostGIS, chuẩn hóa.
- **trust_modifier** — dựa trên rating hai chiều. **Mặc định 1.0 (trung lập) khi chưa có dữ liệu rating** — không được để giá trị mặc định làm lệch điểm gợi ý theo hướng cao/thấp bất thường.

## Vì sao không dùng Collaborative Filtering
Dữ liệu tương tác quá thưa và vòng đời job ngắn trong phạm vi đồ án — không đủ điều kiện chứng minh CF hoạt động đúng. Đây là quyết định kiến trúc đã chốt, **không triển khai CF** dù có ý tưởng cải tiến sau này.

## Explainable AI
Endpoint gợi ý AI **bắt buộc trả breakdown từng thành phần điểm**, không chỉ 1 số `final_score` — mọi kết quả gợi ý phải giải thích được lý do trên UI.

## Đánh giá offline
Precision@k, Recall@k, NDCG@k so với baseline (sort theo thời gian đăng / lọc cứng không xếp hạng). Dữ liệu dùng để đánh giá chủ yếu là seed/mô phỏng (không đủ thời gian pilot test thật trong 5 tuần đầu) — **phải minh bạch giới hạn này khi viết báo cáo**, tránh kết luận mang tính circular.

## Nguồn tham khảo
Chi tiết đầy đủ: `docs/PROJECT_PLAN.md` mục 1.3, 3.3, 7, 8.
