# backend/chatbot/views.py

import os
import sqlite3
import json
import requests
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.conf import settings
from django.shortcuts import render

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# backend 폴더의 절대경로
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DB_PATHS = {
    "members": os.path.join(BACKEND_DIR, 'ranking_members.db'),
    "parties": os.path.join(BACKEND_DIR, 'ranking_parties.db'),
    "default": os.path.join(BACKEND_DIR, 'db.sqlite3'),
}

def get_table_columns(db_path, table_name):
    with sqlite3.connect(db_path) as conn:
        cur = conn.execute(f"PRAGMA table_info({table_name})")
        return [row[1] for row in cur.fetchall()]

print("=== 실제 DB 경로 ===", DB_PATHS["members"])
import os
print("=== 실제 존재하나? ===", os.path.exists(DB_PATHS["members"]))

def search_member(question):
    db_path = DB_PATHS["members"]
    with sqlite3.connect(db_path) as conn:
        columns = get_table_columns(db_path, "ranking_members")
        cur = conn.execute("SELECT * FROM ranking_members")
        for row in cur.fetchall():
            row_dict = dict(zip(columns, row))
            if row_dict["HG_NM"] in question:
                return row_dict
    return {}

def search_party(question):
    db_path = DB_PATHS["parties"]
    with sqlite3.connect(db_path) as conn:
        columns = get_table_columns(db_path, "ranking_parties")
        cur = conn.execute("SELECT * FROM ranking_parties")
        for row in cur.fetchall():
            row_dict = dict(zip(columns, row))
            if row_dict.get("POLY_NM") and row_dict["POLY_NM"] in question:
                return row_dict
    return {}

@csrf_exempt
@require_POST
def chatbot_ask(request):
    data = json.loads(request.body)
    question = data.get("question", "")

    # 우선순위: 의원 → 정당 → 기타
    member_data = search_member(question)
    party_data = search_party(question)
    prompt_data = member_data if member_data else party_data

    # 프롬프트 구성
    prompt = f"""
    사용자 질문: {question}
    관련 데이터: {json.dumps(prompt_data, ensure_ascii=False)}

    위 데이터를 참고해서 답변을 자연스러운 한국어로 해줘.
    (만약 관련 데이터가 없으면 "관련 데이터가 없습니다."라고 말해줘)
    """

    gemini_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GEMINI_API_KEY}"
    }
    gemini_payload = {
        "contents": [
            {"role": "user", "parts": [{"text": prompt}]}
        ]
    }
    try:
        res = requests.post(gemini_url, headers=headers, json=gemini_payload)
        res.raise_for_status()
        gemini_reply = (
            res.json().get('candidates', [{}])[0]
            .get('content', {}).get('parts', [{}])[0]
            .get('text', '관련 데이터가 없습니다.')
        )
    except Exception as e:
        gemini_reply = f"관련 데이터가 없습니다. (에러: {str(e)})"

    return JsonResponse({"answer": gemini_reply, "data": prompt_data})

def chatbot_page(request):
    return render(request, "chatbot/test.html")
