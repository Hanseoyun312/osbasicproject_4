import os
import sqlite3
import openai
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.shortcuts import render
import json

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
SYSTEM_PROMPT =  """
너는 대한민국 국회의원과 정당의 실적 데이터를 분석하는 전문가 챗봇이야. 사용자 질문에 대해 정확하고 신뢰할 수 있는 데이터를 바탕으로 자연스럽고 명확한 한국어로 답변해야 해.

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

"""

MEMBER_DB = os.path.join(os.path.dirname(__file__), "../../ranking_members.db")
PARTY_DB = os.path.join(os.path.dirname(__file__), "../../ranking_parties.db")

def normalize_party_name(name):
    table = {
        "국힘": "국민의힘", "국힘당": "국민의힘", "국민의 힘": "국민의힘",
        "민주당": "더불어민주당", "더민주": "더불어민주당", "더민주당": "더불어민주당", "여당": "더불어민주당",
        "조국당": "조국혁신당", "혁신당": "조국혁신당",
        "기본당": "기본소득당"
    }
    for k, v in table.items():
        if k in name:
            return v
    return name

def get_member_info(name):
    conn = sqlite3.connect(MEMBER_DB)
    c = conn.cursor()
    c.execute("SELECT * FROM ranking_members WHERE HG_NM = ?", (name,))
    row = c.fetchone()
    if row:
        columns = [desc[0] for desc in c.description]
        data = dict(zip(columns, row))
    else:
        data = None
    conn.close()
    return data

def get_party_info(party_name):
    party_std = normalize_party_name(party_name)
    conn = sqlite3.connect(PARTY_DB)
    c = conn.cursor()
    c.execute("SELECT * FROM party_score WHERE POLY_NM = ?", (party_std,))
    score = c.fetchone()
    score_cols = [desc[0] for desc in c.description] if score else []
    c.execute("SELECT * FROM party_statistics_kr WHERE 정당 = ?", (party_std,))
    stat = c.fetchone()
    stat_cols = [desc[0] for desc in c.description] if stat else []
    conn.close()
    score_data = dict(zip(score_cols, score)) if score else None
    stat_data = dict(zip(stat_cols, stat)) if stat else None
    return score_data, stat_data

def extract_query_intent(question):
    import re
    q = question.strip()
    name_match = re.search(r'([가-힣]{2,4})\s?의원?', q)
    if name_match:
        name = name_match.group(1)
        return {"type": "member", "name": name}
    party_match = re.search(r'(더불어민주당|국민의힘|조국혁신당|기본소득당|정의당|새로운미래|진보당|개혁신당|국힘|더민주|더민주당|국힘당|조국당|혁신당|기본당)', q)
    if party_match:
        party = normalize_party_name(party_match.group(1))
        return {"type": "party", "party": party}
    return {"type": "general"}

def make_llm_message(system_prompt, user_message, db_result):
    if not db_result:
        db_info = "관련 데이터가 없습니다."
    else:
        db_info = json.dumps(db_result, ensure_ascii=False)
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"{user_message}\n\n(참고 데이터: {db_info})"}
    ]

@csrf_exempt
def chatbot_api(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    data = json.loads(request.body.decode())
    question = data.get("question", "")

    intent = extract_query_intent(question)
    db_result = None
    if intent["type"] == "member":
        db_result = get_member_info(intent["name"])
        if db_result is None:
            return JsonResponse({"answer": "이름을 조금 더 정확히 입력해주세요."})
    elif intent["type"] == "party":
        score, stat = get_party_info(intent["party"])
        if not (score or stat):
            return JsonResponse({"answer": "관련 데이터가 없습니다."})
        db_result = {"score": score, "stat": stat}
    else:
        db_result = None

    try:
        openai.api_base = "https://openrouter.ai/api/v1"   # ← 꼭 추가!
        openai.api_key = OPENROUTER_API_KEY
        openai.organization = None  # 혹시 모를 충돌 방지
        messages = make_llm_message(SYSTEM_PROMPT, question, db_result)
        completion = openai.ChatCompletion.create(
            model="meta-llama/llama-3-70b-instruct",  # ← "openrouter/" 빼고!
            messages=messages,
            max_tokens=512,
            temperature=0.2,
        )
        answer = completion["choices"][0]["message"]["content"].strip()
        return JsonResponse({"answer": answer})
    except Exception as e:
        return JsonResponse({"answer": f"❌ 오류가 발생했습니다: {str(e)}"})

def chatbot_page(request):
    return render(request, "chatbot/test.html")
