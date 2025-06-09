from django.shortcuts import render

# Create your views here.
from django.http import JsonResponse
import sqlite3

DB_PATH = "performance.db"
COLUMNS = ["총점", "출석", "법안가결", "청원제시", "청원결과", "위원회", "기권_무효", "표결일치", "표결불일치"]

def compare_members(request):
    member1 = request.GET.get('member1')
    member2 = request.GET.get('member2')

    if not member1 or not member2:
        return JsonResponse({"error": "두 의원 이름을 'member1'과 'member2' 파라미터로 전달하세요."}, status=400)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 전체 의원 총점 기준 순위 계산
    cur.execute("SELECT HG_NM, 총점 FROM performance_score ORDER BY 총점 DESC")
    all_members = cur.fetchall()
    rank_dict = {name: idx + 1 for idx, (name, _) in enumerate(all_members)}

    # 비교 대상 두 명 가져오기
    cur.execute(f"""
        SELECT HG_NM, {', '.join(COLUMNS)}
        FROM performance_score
        WHERE HG_NM IN (?, ?)
    """, (member1, member2))
    rows = cur.fetchall()
    conn.close()

    if len(rows) != 2:
        return JsonResponse({"error": "의원 이름이 정확하지 않거나 두 명 모두 존재하지 않습니다."}, status=404)

    data = {}
    for row in rows:
        name = row[0]
        scores = dict(zip(COLUMNS, row[1:]))
        data[name] = scores

    comparison = {}
    for col in COLUMNS:
        score1 = data[member1][col]
        score2 = data[member2][col]
        if score1 > score2:
            winner = member1
        elif score2 > score1:
            winner = member2
        else:
            winner = "동점"
        comparison[col] = {
            member1: score1,
            member2: score2,
            "우세": winner
        }

    return JsonResponse({
        "비교항목": COLUMNS,
        "의원비교": comparison,
        "순위": {
            member1: rank_dict.get(member1, "알 수 없음"),
            member2: rank_dict.get(member2, "알 수 없음")
        }
    })
