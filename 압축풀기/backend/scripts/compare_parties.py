# 정당 비교하기
from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)
DB_PATH = "ranking.db"

# 비교할 항목 목록 (20개 항목)
COMPARISON_FIELDS = [
    "출석_평균", "출석_최고", "출석_최저", "출석_표준편차",
    "기권무효_평균", "기권무효_최고", "기권무효_최저", "기권무효_표준편차",
    "표결일치_평균", "표결일치_최고", "표결일치_최저", "표결일치_표준편차",
    "표결불일치_평균", "표결불일치_최고", "표결불일치_최저", "표결불일치_표준편차",
    "법안가결_총합", "청원제시_총합", "청원결과_총합", "위원회_총합"
]

@app.route("/compare_parties", methods=["GET"])
def compare_parties():
    party1 = request.args.get("party1")
    party2 = request.args.get("party2")

    if not party1 or not party2:
        return jsonify({"error": "두 정당 이름을 party1, party2로 입력하세요."}), 400

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    query = f"""
        SELECT 정당, {', '.join(COMPARISON_FIELDS)}
        FROM party_statistics_kr
        WHERE 정당 = ? OR 정당 = ?
    """
    cur.execute(query, (party1, party2))
    rows = cur.fetchall()
    conn.close()

    if len(rows) != 2:
        return jsonify({"error": "입력한 정당이 DB에 없거나, 중복되었습니다."}), 404

    data = {row[0]: dict(zip(COMPARISON_FIELDS, row[1:])) for row in rows}
    comparison = {}

    for field in COMPARISON_FIELDS:
        p1_val = data[party1][field]
        p2_val = data[party2][field]

        if p1_val > p2_val:
            better = party1
        elif p1_val < p2_val:
            better = party2
        else:
            better = "동점"

        comparison[field] = {
            party1: p1_val,
            party2: p2_val,
            "우세": better
        }

    return jsonify({
        "비교항목": comparison,
        "정당1": party1,
        "정당2": party2
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
