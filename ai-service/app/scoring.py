import math
import re
import unicodedata
from collections import Counter
from datetime import datetime, timedelta

# ponytail: trọng số chọn tay, hiệu chỉnh bằng đánh giá offline (Precision@k/NDCG@k) trước mốc khóa tuần 6
WEIGHTS = {"semantic": 0.35, "time_feasibility": 0.35, "geo": 0.2, "trust": 0.1}
# ponytail: tốc độ xe máy nội thành cố định, thay bằng API định tuyến nếu cần thời gian đi thật
TRAVEL_SPEED_KMH = 20
EARTH_RADIUS_KM = 6371.0088

Interval = tuple[datetime, datetime]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _terms(text: str) -> list[str]:
    # NFC: cùng chữ có dấu nhưng khác cách mã hoá (tổ hợp/dựng sẵn) phải ra cùng token.
    # Thêm bigram âm tiết vì từ tiếng Việt thường gồm 2 âm tiết ("dọn dẹp", "trông trẻ").
    syllables = re.findall(r"\w+", unicodedata.normalize("NFC", text).lower())
    return syllables + [f"{a} {b}" for a, b in zip(syllables, syllables[1:])]


def semantic_scores(query: str, docs: list[str]) -> list[float]:
    """Cosine TF-IDF giữa mô tả người tìm việc và từng job; IDF tính trên chính lô job + query."""
    # ponytail: IDF theo từng request (AI service không giữ state), đổi sang embedding + pgvector ở tuần 6
    bags = [Counter(_terms(t)) for t in [query, *docs]]
    n = len(bags)
    df = Counter(term for bag in bags for term in bag)
    idf = {term: math.log((1 + n) / (1 + d)) + 1 for term, d in df.items()}

    def vector(bag: Counter) -> dict[str, float]:
        v = {term: count * idf[term] for term, count in bag.items()}
        norm = math.sqrt(sum(x * x for x in v.values()))
        return {term: x / norm for term, x in v.items()} if norm else {}

    q, *ds = [vector(b) for b in bags]
    return [sum(w * d.get(term, 0.0) for term, w in q.items()) for d in ds]


def merge_intervals(intervals: list[Interval]) -> list[Interval]:
    merged: list[Interval] = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def time_feasibility(availability: list[Interval], job: Interval, travel_minutes: float) -> float:
    """Tỉ lệ khung [bắt đầu - đi tới, kết thúc + đi về] nằm trong lịch rảnh (hợp các interval)."""
    travel = timedelta(minutes=travel_minutes)
    need_start, need_end = job[0] - travel, job[1] + travel
    covered = sum(
        (min(end, need_end) - max(start, need_start)).total_seconds()
        for start, end in merge_intervals(availability)
        if start < need_end and end > need_start
    )
    return covered / (need_end - need_start).total_seconds()


def geo_score(distance_km: float, radius_km: float) -> float:
    """Min-max với cận cố định [0, radius]: tại chỗ = 1, ở rìa bán kính trở ra = 0."""
    return 1 - min(distance_km, radius_km) / radius_km


def final_score(breakdown: dict[str, float]) -> float:
    return sum(WEIGHTS[k] * breakdown[k] for k in WEIGHTS)
