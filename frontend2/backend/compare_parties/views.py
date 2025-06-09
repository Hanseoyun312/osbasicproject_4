from django.shortcuts import render

# Create your views here.
from django.http import JsonResponse
from django.views.decorators.http import require_GET
import sqlite3

DB_PATH = 'ranking.db'

COMPARISON_FIELDS = [
    "출석_평균", "출석_최고", "출석_최저", "출석_표준편차",
    "기권무효_평균", "기권무효_최고", "기권무효_최저", "기권무효_표준편차",
    "표결일치_평균", "표결일치_최고", "표결일치_최저", "표결일치_표준편차",
    "표결불일치_평균", "표결불일치_최고", "표결불일치_최저", "표결불일치_표준편차",
    "법안가결_총합", "청원제시_총합", "청원결과_총합", "위원회_총합"
]

@require_GET
def compare_parties(request):
    party1 = request.GET.get('party1')
    party2 = request.GET.get('party2')

    if not party1 or not party2:
        return JsonResponse({"error": "두 정당 이름을 party1, party2로 입력하세요."}, status=400)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 전체 정당 평균실적 가져오기
    cur.execute("SELECT POLY_NM, 평균실적 FROM party_score ORDER BY 평균실적 DESC")
    all_parties = cur.fetchall()
    rank_dict = {party: idx + 1 for idx, (party, _) in enumerate(all_parties)}

    # 비교 대상 정당 정보 가져오기
    query = f"""
        SELECT 정당, {', '.join(COMPARISON_FIELDS)}
        FROM party_statistics_kr
        WHERE 정당 = ? OR 정당 = ?
    """
    cur.execute(query, (party1, party2))
    rows = cur.fetchall()
    conn.close()

    if len(rows) != 2:
        return JsonResponse({"error": "입력한 정당이 DB에 없거나, 중복되었습니다."}, status=404)

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

    return JsonResponse({
        "비교항목": comparison,
        "순위": {
            party1: rank_dict.get(party1, "알 수 없음"),
            party2: rank_dict.get(party2, "알 수 없음")
        }
    })
