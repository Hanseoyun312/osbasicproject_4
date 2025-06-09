from django.shortcuts import render

# Create your views here.
from django.http import JsonResponse
import sqlite3

DB_PATH = "performance.db"  # DB 위치는 필요에 따라 조정

def search_members(request):
    name = request.GET.get('name', '')
    party = request.GET.get('party', '')
    attend = request.GET.get('attend')
    bill = request.GET.get('bill')
    petition = request.GET.get('petition')
    absent = request.GET.get('absent')
    committee = request.GET.get('committee')

    conditions = []
    params = []

    if name:
        conditions.append("HG_NM LIKE ?")
        params.append(f"%{name}%")
    if party:
        conditions.append("POLY_NM LIKE ?")
        params.append(f"%{party}%")  # 부분검색 가능하게 변경
    if attend:
        conditions.append("출석 >= ?")
        params.append(attend)
    if bill:
        conditions.append("법안가결 >= ?")
        params.append(bill)
    if petition:
        conditions.append("청원제시 >= ?")
        params.append(petition)
    if absent:
        conditions.append("기권_무효 >= ?")
        params.append(absent)
    if committee:
        conditions.append("위원회 LIKE ?")
        params.append(f"%{committee}%")  # 부분검색 가능하게 변경

    query = "SELECT * FROM performance_score"
    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(query, params)
    rows = cur.fetchall()
    columns = [col[0] for col in cur.description]
    conn.close()

    results = [dict(zip(columns, row)) for row in rows]

    return JsonResponse({"results": results})
