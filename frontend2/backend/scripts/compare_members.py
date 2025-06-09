# 의원 비교하기
from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)
DB_PATH = "performance.db"

COLUMNS = ["총점", "출석", "법안가결", "청원제시", "청원결과", "위원회", "기권_무효", "표결일치", "표결불일치"]

@app.route("/compare_lawmakers", methods=["GET"])
def compare_lawmakers():
    lawmaker1 = request.args.get("lawmaker1")
    lawmaker2 = request.args.get("lawmaker2")
    
    if not lawmaker1 or not lawmaker2:
        return jsonify({"error": "두 의원 이름을 'lawmaker1'과 'lawmaker2' 파라미터로 전달하세요."}), 400

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    cur.execute(f"""
        SELECT HG_NM, {', '.join(COLUMNS)}
        FROM performance_score
        WHERE HG_NM IN (?, ?)
    """, (lawmaker1, lawmaker2))

    rows = cur.fetchall()
    conn.close()

    if len(rows) != 2:
        return jsonify({"error": "의원 이름이 정확하지 않거나 두 명 모두 존재하지 않습니다."}), 404

    data = {}
    for row in rows:
        name = row[0]
        scores = dict(zip(COLUMNS, row[1:]))
        data[name] = scores

    # 비교 결과 생성
    comparison = {}
    for col in COLUMNS:
        score1 = data[lawmaker1][col]
        score2 = data[lawmaker2][col]
        if score1 > score2:
            winner = lawmaker1
        elif score2 > score1:
            winner = lawmaker2
        else:
            winner = "동점"
        comparison[col] = {
            lawmaker1: score1,
            lawmaker2: score2,
            "우세": winner
        }

    return jsonify({
        "비교항목": COLUMNS,
        "의원비교": comparison
    })

if __name__ == "__main__":
    app.run(debug=True)
