# backend/chatbot/views.py

import os
import sqlite3
import json
import requests
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.shortcuts import render
from dotenv import load_dotenv

load_dotenv()


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DB_PATHS = {
    "members": os.path.join(BACKEND_DIR, 'ranking_members.db'),
    "parties": os.path.join(BACKEND_DIR, 'ranking_parties.db'),
    "default": os.path.join(BACKEND_DIR, 'db.sqlite3'),
}

def get_db_schema(db_path):
    schema = {}
    with sqlite3.connect(db_path) as conn:
        cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cur.fetchall()]
        for t in tables:
            cur2 = conn.execute(f"PRAGMA table_info({t});")
            columns = [row[1] for row in cur2.fetchall()]
            schema[t] = columns
    return schema

def find_best_match(db_path, schema, question):
    with sqlite3.connect(db_path) as conn:
        for table, columns in schema.items():
            # (1) "1위", "최고", "최대" 등 최대값
            for col in columns:
                if col in question:
                    if any(word in question for word in ['1위', '최고', '최대']):
                        try:
                            cur = conn.execute(f"SELECT * FROM {table} ORDER BY {col} DESC LIMIT 1")
                            row = cur.fetchone()
                            if row:
                                return {
                                    "table": table,
                                    "matched_column": col,
                                    "mode": "최대값",
                                    "row": dict(zip(columns, row))
                                }
                        except Exception:
                            pass
                    if any(word in question for word in ['최저', '최소', '꼴찌', '꼴등', '마지막']):
                        try:
                            cur = conn.execute(f"SELECT * FROM {table} ORDER BY {col} ASC LIMIT 1")
                            row = cur.fetchone()
                            if row:
                                return {
                                    "table": table,
                                    "matched_column": col,
                                    "mode": "최소값",
                                    "row": dict(zip(columns, row))
                                }
                        except Exception:
                            pass
            # (2) 특정 이름/정당/값으로 정확히 찾기
            for col in columns:
                # 질문을 띄어쓰기 기준으로 쪼개서 각 단어가 컬럼값과 일치하는지
                for word in question.replace(" ", "").split():
                    try:
                        cur = conn.execute(f"SELECT * FROM {table} WHERE {col}=?", (word,))
                        row = cur.fetchone()
                        if row:
                            return {
                                "table": table,
                                "matched_column": col,
                                "mode": "이름/정당",
                                "row": dict(zip(columns, row))
                            }
                    except Exception:
                        continue
    return None

@csrf_exempt
@require_POST
def chatbot_ask(request):
    try:
        data = json.loads(request.body)
        question = data.get("question", "")

        members_schema = get_db_schema(DB_PATHS["members"])
        parties_schema = get_db_schema(DB_PATHS["parties"])
        default_schema = get_db_schema(DB_PATHS["default"])

        # members → parties → default 순서 탐색
        result = (
            find_best_match(DB_PATHS["members"], members_schema, question) or
            find_best_match(DB_PATHS["parties"], parties_schema, question) or
            find_best_match(DB_PATHS["default"], default_schema, question)
        )

        prompt_data = result["row"] if result else {}
        prompt_info = f"table: {result['table']}, column: {result['matched_column']}, mode: {result['mode']}" if result else ""

        prompt = f"""
        사용자 질문: {question}
        데이터 추출정보: {prompt_info}
        관련 데이터: {json.dumps(prompt_data, ensure_ascii=False)}

        위 데이터를 참고해서 답변을 자연스러운 한국어로 해줘.
        (관련 정보가 명확하지 않거나 없다면, '관련 데이터가 없습니다.'라고 해줘)
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
        res = requests.post(gemini_url, headers=headers, json=gemini_payload)
        res.raise_for_status()
        gemini_reply = (
            res.json().get('candidates', [{}])[0]
            .get('content', {}).get('parts', [{}])[0]
            .get('text', '관련 데이터가 없습니다.')
        )
        return JsonResponse({"answer": gemini_reply, "data": prompt_data})

    except Exception as e:
        return JsonResponse({"answer": f"관련 데이터가 없습니다. (에러: {str(e)})"}, status=500)

def chatbot_page(request):
    return render(request, "chatbot/test.html")
