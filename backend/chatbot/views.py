# backend/chatbot/views.py (최적화 + 성능 우선 버전)
import sqlite3
import requests
import os
from dotenv import load_dotenv
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render
import json

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

BASE_DIR = os.path.dirname(__file__)
RANKING_MEMBERS_DB = os.path.join(BASE_DIR, '..', 'ranking_members.db')
RANKING_PARTIES_DB = os.path.join(BASE_DIR, '..', 'ranking_parties.db')

# 필드 저장용 전역변수
MEMBER_FIELDS = []
PARTY_FIELDS = []

# DB에서 컬럼명 불러오기
def load_all_fields():
    global MEMBER_FIELDS, PARTY_FIELDS
    try:
        with sqlite3.connect(RANKING_MEMBERS_DB) as conn:
            cursor = conn.execute("PRAGMA table_info(ranking_members)")
            MEMBER_FIELDS = [row[1] for row in cursor.fetchall() if row[1]]
        with sqlite3.connect(RANKING_PARTIES_DB) as conn:
            cursor1 = conn.execute("PRAGMA table_info(party_score)")
            cursor2 = conn.execute("PRAGMA table_info(party_statistics_kr)")
            PARTY_FIELDS = [row[1] for row in cursor1.fetchall() if row[1]] + [row[1] for row in cursor2.fetchall() if row[1]]
    except:
        MEMBER_FIELDS = ["HG_NM", "POLY_NM"]
        PARTY_FIELDS = ["정당"]

load_all_fields()

# 정당 이름 정규화
def normalize_party_name(user_input):
    party_map = {
        "국힘": "국민의힘", "국민의 힘": "국민의힘", "국힘당": "국민의힘",
        "민주당": "더불어민주당", "더민주": "더불어민주당", "여당": "더불어민주당",
        "조국당": "조국혁신당", "혁신당": "조국혁신당", "기본당": "기본소득당"
    }
    for k, v in party_map.items():
        if k in user_input:
            return v
    return None

# 테이블 필드와 사용자 질문 간의 연관성 판별
def is_relevant(field_list, user_input):
    return any(col in user_input for col in field_list)

# 모든 테이블을 기준으로 유사 키워드가 있을 경우 필터링된 데이터를 모두 포함

def get_filtered_data(user_input):
    data = {}
    try:
        norm_party = normalize_party_name(user_input)
        found_any = False

        # 의원 관련
        with sqlite3.connect(RANKING_MEMBERS_DB) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM ranking_members")
            members = [dict(row) for row in cur.fetchall()]
            if any(norm_party in str(v) or any(name in str(v) for name in ["의원", "출석", "청원", "법안", "위원회", "기권"]) for row in members for v in row.values()) or is_relevant(MEMBER_FIELDS, user_input):
                data["ranking_members"] = members
                found_any = True

        # 정당 관련
        with sqlite3.connect(RANKING_PARTIES_DB) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM party_score")
            party_score = [dict(row) for row in cur.fetchall()]
            cur.execute("SELECT * FROM party_statistics_kr")
            party_stats = [dict(row) for row in cur.fetchall()]

            if any(norm_party in str(v) or any(word in str(v) for word in ["정당", "평균실적", "출석률", "기권률", "표결일치", "청원"]) for row in party_score + party_stats for v in row.values()) or is_relevant(PARTY_FIELDS, user_input):
                data["party_score"] = party_score
                data["party_statistics_kr"] = party_stats
                found_any = True

        if not found_any:
            return {}
        return data
    except Exception as e:
        return {"error": str(e)}

@csrf_exempt
def chatbot_api(request):
    if request.method == "POST":
        try:
            body = json.loads(request.body)
            user_input = body.get("message", "")
            db_data = get_filtered_data(user_input)

            if not db_data:
                return JsonResponse({"response": "관련 데이터가 없습니다. 다른 질문을 부탁드립니다."})

            system_prompt = """
너는 대한민국 국회의원과 정당의 실적 데이터를 분석하는 전문가 챗봇이야. 질문이 불명확하더라도 전체 데이터를 참고해 유추해서 답변해. DB는 'ranking_members', 'party_score', 'party_statistics_kr' 3가지이며, 정당은 8개, 의원은 300명으로 구성돼.
질문이 불완전해도 이름이나 단어 하나만 포함되어 있다면 전체 테이블을 활용해서 답변하도록 해.

반드시 지켜야 할 지침:
1. DB에 존재하는 실제 데이터만 기반으로 답변해. 만들어내거나 과장하지 마.
    - 국회의원을 묻는 질문엔 'ranking_members' 테이블을 기준으로 삼아.
    - 정당을 묻는 질문엔 'party_score' 또는 'party_statistics_kr' 테이블을 기준으로 삼아.
    - 정당의 '평균실적', '가중점수', '의원수' 등은 'party_score' 테이블을 참고해.
    - 정당의 출석률, 기권률, 표결일치율 등은 'party_statistics_kr' 테이블을 참고해.
        - '정당의 의원수'는 party_score 테이블의 '의원수' 컬럼을 의미해.
        - '정당의 출석률'은 party_statistics_kr 테이블의 '출석_평균' 컬럼을 의미해.
        - '정당의 기권률'은 party_statistics_kr 테이블의 '기권무효_평균' 컬럼을 의미해.  
        - '정당의 표결일치율'은 party_statistics_kr 테이블의 '표결일치_평균' 컬럼을 의미해.
        - '정당의 청원제시'는 party_statistics_kr 테이블의 '청원제시_평균' 컬럼을 의미해.
        - '정당의 청원결과'는 party_statistics_kr 테이블의 '청원결과_평균' 컬럼을 의미해.
        - '정당의 법안가결'은 party_statistics_kr 테이블의 '법안가결_평균' 컬럼을 의미해.
2. 질문이 오타나 비표준 표현(예: '국힘', '민주당', '더민주')을 포함하더라도 의도를 유추하고 정규화해. 
    - '국힘', '국힘당', '국민의 힘' → '국민의힘'
    - '민주당', '더민주', '더민주당', '여당' → '더불어민주당'
    - '조국당', '혁신당' → '조국혁신당'
    - '기본당' → '기본소득당'
3. 의원 이름이 불완전하면 '이름을 조금 더 정확히 입력해주세요'라고 응답해.
4. 출석률, 청원제시, 법안가결 등 성과 항목을 묻는 질문은 평균, 최고, 최저, 표준편차 등 상세 항목을 구분하여 알려주거나 어떤 항목을 원하는지 사용자에게 되물어봐.
    - 예를 들어, '출석률이 가장 높은 의원은 누구야?'라고 하면 '출석률'을 기준으로 최고치를 가진 의원을 알려줘.
5. '출석률 1위는 누구야?', '청원제시 1위 정당은?' 같은 순위 요청이 들어오면 해당 항목을 기준으로 순위를 답변해. '_순위'로 끝나는 컬럼명을 참고하면 돼.
6. 숫자를 기계적으로 나열하지 말고, 사용자에게 읽기 쉬운 형태로 자연스럽게 문장화해서 응답해.
7. 국회의원 실적은 'ranking_members', 정당 실적은 'party_score', 정당 통계는 'party_statistics_kr' 테이블을 기준으로 삼아.
8. 국회의원 수는 총 300명이며, 정당 수는 8개의 당이 있어. 정당별 의원수는 'party_score' 테이블의 '의원수' 컬럼을 참고해. 
9. '가장 많은', '가장 높은', '가장 큰', '제일 많은' 등 표현은 해당 값의 오름차순 기준으로 1위를, 내림차순 기준으로 꼴찌를 의미해. 이점은 각 순위를 참고해.
10. '가장 적은', '가장 낮은', '가장 작은', '제일 낮은' 등 표현은 해당 값의 오름차순 기준으로 꼴찌를, 내림차순 기준으로 1위를 의미해. 이 점은 각 순위를 참고해.
11. '정당의 총점' 또는 '정당의 점수'는 party_score 테이블의 '평균실적' 컬럼을 의미해.
    - '정당의 총 순위'는 party_score 테이블의 '총 순위' 컬럼을 의미해.
12. '가중치', '가중점수'라고 하면 party_score 테이블의 '가중점수' 컬럼을 의미해.
13. '의원 수', '총 몇 명', '전원 몇 명' 등 의원 수를 묻는 질문은 party_score 테이블의 '의원수' 컬럼을 의미해.
14. 사용자가 특정 정당의 의원 수를 물을 경우, party_score 테이블에서 '정당명'이 일치하는 행의 '의원수' 값을 알려줘.
    - '국민의힘 의원 수는 몇 명이야?' → '국민의힘' 정당의 '의원수' 값을 알려줘. (정당의 이름은 2번 지침을 참고해)
    - '더불어민주당 의원은 총 몇 명이야?' → '더불어민주당' 정당의 '의원수' 값을 알려줘. 
15. 요청이 애매할 시에 사용자에게 명확한 질문을 요청하되, 너무 많은 질문을 하지 않도록 주의해.
"""

            prompt = f"""
[관련 데이터]
{json.dumps(db_data, ensure_ascii=False)}

사용자 질문: {user_input}
답변:
"""

            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ]
            }

            response = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            if response.status_code != 200:
                return JsonResponse({"response": f"[Groq 오류] 응답 실패: {response.text}"})

            json_response = response.json()
            if "choices" not in json_response:
                return JsonResponse({"response": f"[Groq 오류] 응답 구조 이상: {json_response}"})

            reply = json_response["choices"][0]["message"]["content"]
            reply = reply.replace('\n', '<br>')
            return JsonResponse({"response": reply})

        except Exception as e:
            return JsonResponse({"response": f"[예외 발생] {str(e)}"})

    return JsonResponse({"response": "POST 요청을 보내주세요."})

def chatbot_page(request):
    return render(request, "chatbot/test.html")
