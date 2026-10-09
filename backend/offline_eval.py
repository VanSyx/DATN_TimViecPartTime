"""Đánh giá offline gợi ý AI trên dữ liệu seed: P@k, R@k, NDCG@k so với baseline.

Chạy (sau `python seed.py`, cần ai-service đang chạy):
    docker compose exec backend python offline_eval.py

Đi đúng đường production: GET /recommendations → ai-service. Nhãn do người gán từ câu chuyện của
từng nhân vật trong seed.py (mô tả + lịch rảnh + ràng buộc tự nêu), KHÔNG sinh từ công thức:
  2 = làm được việc (theo mô tả) VÀ rảnh trọn khung giờ VÀ không vi phạm ràng buộc tự nêu
  1 = làm được việc nhưng chỉ rảnh một phần giờ, hoặc rảnh trọn giờ và việc gần với mô tả
  0 = còn lại
Giới hạn (ghi vào báo cáo): cùng một người viết dữ liệu seed, gán nhãn và thiết kế công thức; 6 nhân vật × 10 tin.
"""

import logging
import math
from itertools import product

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import SessionLocal
from app.main import app
from app.models import User
from app.security import create_access_token

RADIUS_KM = 10
J = {
    "J1": "Dọn nhà sáng thứ 7", "J2": "Trông bé trai 5 tuổi buổi tối", "J3": "Phụ quán cafe ca sáng",
    "J4": "Phụ quán cafe ca sáng thứ 5", "J5": "Đi chợ, nấu cơm trưa, chăm bà", "J6": "Nấu cơm trưa cho ông bà (thứ 5)",
    "J7": "Tổng vệ sinh căn hộ sau sửa chữa", "J10": "Phụ bếp, rửa bát tiệc cưới trưa CN",
    "J12": "Dắt chó đi dạo + tưới cây", "J14": "Giặt ủi, dọn nhà sáng thứ 7",
}
# (email, vị trí tìm việc, nhãn ≠ 0). Vy (TP.HCM) và Đức (Đà Nẵng) chỉ có 1 tin trong bán kính nên
# mọi cách xếp đều như nhau; Phương chưa khai gì nên không có căn cứ gán nhãn — cả 3 không tính.
PERSONAS = {
    # SV: dọn dẹp, rửa bát, giặt ủi, trông em; rảnh chiều T2-T6, cả ngày T7-CN
    "lan": ("lan.nguyen@example.com", (21.0045, 105.8505), {"J1": 2, "J7": 2, "J10": 2, "J14": 2}),
    # Xe ôm: phụ quán, bưng bê, rửa ly; chỉ rảnh 05:30-10:00; J10 bưng bê nhưng kéo tới 15h
    "hung": ("hung.tran@example.com", (21.034, 105.790), {"J3": 2, "J4": 2, "J10": 1}),
    # Nghỉ hưu: nấu ăn, chăm người già; T2-T6 08-14, không tối, ≤ 5 km
    "hoa": ("hoa.le@example.com", (21.020, 105.826), {"J5": 2, "J6": 2}),
    # Văn phòng: trông trẻ, kèm học; rảnh tối từ 18:30 + CN; J2 bắt đầu 18:00 nên chỉ một phần
    "trang": ("trang.pham@example.com", (20.995, 105.808), {"J2": 1}),
    # SV gõ không dấu: dọn nhà, khuân đồ; cuối tuần 07-18
    "tuananh": ("tuananh.vu@example.com", (21.005, 105.843), {"J1": 2, "J7": 2, "J14": 2, "J10": 1}),
    # Cần việc gấp, liệt kê: dọn nhà, rửa bát, phụ quán, bốc vác; 07-21 mỗi ngày (J3/J4 bắt đầu 06:00)
    "nam": ("nam.do@example.com", (21.006, 105.855), {"J1": 2, "J7": 2, "J10": 2, "J14": 2, "J3": 1, "J4": 1}),
}
KS = (3, 5)
CURRENT = (0.35, 0.35, 0.2)  # trust 0.1 là hằng số với mọi tin nên không đổi thứ hạng


def dcg(rels: list[int], k: int) -> float:
    return sum((2**r - 1) / math.log2(i + 2) for i, r in enumerate(rels[:k]))


def metrics(ranked: list[str], labels: dict[str, int], k: int) -> dict[str, float | None]:
    rels = [labels.get(j, 0) for j in ranked]
    ideal = dcg(sorted(labels.values(), reverse=True), k)
    n_rel = sum(v == 2 for v in labels.values())
    hits = sum(r == 2 for r in rels[:k])
    return {
        f"P@{k}": hits / k if n_rel else None,
        f"R@{k}": hits / n_rel if n_rel else None,
        f"NDCG@{k}": dcg(rels, k) / ideal if ideal else None,
    }


def fetch() -> dict[str, list[dict]]:
    """Ứng viên + breakdown của từng nhân vật, lấy qua chính endpoint production."""
    client = TestClient(app)
    out = {}
    with SessionLocal() as db:
        # TF-IDF tính IDF trên toàn bộ tin ứng viên: thêm tin của seed_history.py là kết quả đổi theo
        assert not db.scalar(select(User.id).where(User.email.like("%@example.net")).limit(1)), \
            "DB có dữ liệu seed_history.py — đánh giá offline chỉ chạy trên DB chỉ có seed.py"
        for key, (email, (lat, lng), _) in PERSONAS.items():
            user = db.scalar(select(User).where(User.email == email))
            res = client.get(
                "/recommendations", params={"lat": lat, "lng": lng, "radius_km": RADIUS_KM},
                headers={"Authorization": f"Bearer {create_access_token(user.id, user.role)}"},
            ).json()
            assert res["source"] == "ai", "ai-service không phản hồi — kiểm tra docker compose"
            ids = {t: k for k, t in J.items()}
            out[key] = [{"id": ids[i["job"]["title"]], "km": i["job"]["distance_km"], **i["breakdown"]} for i in res["items"]]
    return out


def rankers(weights_grid):
    def by(score):
        return lambda items: [i["id"] for i in sorted(items, key=lambda i: (-score(i), i["id"]))]

    yield "Baseline: gần nhất trước (chế độ dự phòng)", by(lambda i: -i["km"])
    yield "Baseline: lọc cứng trùng giờ rảnh, rồi gần nhất", lambda items: by(lambda i: -i["km"])([i for i in items if i["time_feasibility"] > 0])
    yield "Chỉ mô tả (semantic)", by(lambda i: i["semantic"])
    yield "Chỉ giờ rảnh (time_feasibility)", by(lambda i: i["time_feasibility"])
    for w in weights_grid:
        yield w, by(lambda i, w=w: w[0] * i["semantic"] + w[1] * i["time_feasibility"] + w[2] * i["geo"])


def evaluate(data, rank, keys) -> dict[str, float]:
    rows = [metrics(rank(data[p]), PERSONAS[p][2], k) for p in keys for k in KS]
    names = [f"{m}@{k}" for k in KS for m in ("P", "R", "NDCG")]
    return {n: _mean([r[n] for r in rows if n in r]) for n in names}


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def main():
    logging.getLogger("httpx").setLevel(logging.WARNING)
    # tự kiểm: xếp đúng thứ tự lý tưởng thì NDCG = 1, xếp ngược thì < 1
    assert metrics(["a", "b", "c"], {"a": 2, "b": 1}, 3)["NDCG@3"] == 1
    assert metrics(["c", "b", "a"], {"a": 2, "b": 1}, 3)["NDCG@3"] < 1

    data = fetch()
    keys = list(PERSONAS)
    grid = [(s / 20, t / 20, round(0.9 - (s + t) / 20, 2)) for s, t in product(range(19), range(19)) if s + t <= 18]
    table = {name: evaluate(data, rank, keys) for name, rank in rankers([CURRENT])}
    scored = sorted(((evaluate(data, r, keys)["NDCG@5"], w) for w, r in rankers(grid) if isinstance(w, tuple)), reverse=True)

    cols = ["P@3", "R@3", "NDCG@3", "P@5", "R@5", "NDCG@5"]
    print(f"{len(keys)} nhân vật, {sum(len(v) for v in data.values())} cặp (nhân vật, tin) trong bán kính {RADIUS_KM} km\n")
    print("| Cách xếp | " + " | ".join(cols) + " |\n|---|" + "---|" * len(cols))
    for name, m in table.items():
        label = f"AI hiện tại {name}" if isinstance(name, tuple) else name
        print(f"| {label} | " + " | ".join(f"{m[c]:.2f}" for c in cols) + " |")

    print("\nLưới trọng số (mô tả, giờ rảnh, khoảng cách; tin cậy 0.1), top 5 theo NDCG@5:")
    for ndcg, w in scored[:5]:
        print(f"  {w} → NDCG@5 {ndcg:.3f}")
    rank_current = next(i for i, (_, w) in enumerate(scored) if w == CURRENT) + 1
    print(f"  trọng số hiện tại {CURRENT}: hạng {rank_current}/{len(scored)}")

    # Bỏ ra 1 nhân vật: chọn trọng số tốt nhất trên 5 người còn lại, đo trên người bị bỏ ra
    print("\nKiểm tra chéo bỏ-1-nhân-vật (NDCG@5 trên nhân vật bị bỏ ra):")
    for p in keys:
        rest = [q for q in keys if q != p]
        best = max(grid, key=lambda w: evaluate(data, dict(rankers([w]))[w], rest)["NDCG@5"])
        tuned = evaluate(data, dict(rankers([best]))[best], [p])["NDCG@5"]
        cur = evaluate(data, dict(rankers([CURRENT]))[CURRENT], [p])["NDCG@5"]
        print(f"  {p:8} tốt nhất trên phần còn lại {best} → {tuned:.3f} | hiện tại → {cur:.3f}")


if __name__ == "__main__":
    main()
