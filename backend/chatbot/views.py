# backend/chatbot/views.py
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

# DB 파일 경로
RANKING_DB = os.path.join(os.path.dirname(__file__), '..', 'ranking_parties.db')
RANKING_MEMBER = os.path.join(os.path.dirname(__file__), '..', 'ranking_member.db')

# 사용자 질문에서 키워드 추출 및 필드 판별
KEYWORD_MAPPING = {
    "총점": ("ranking_member", ["HG_NM", "POLY_NM", "총점"]),
    "출석": ("ranking_member", ["HG_NM", "POLY_NM", "출석"]),
    "법안": ("ranking_member", ["HG_NM", "POLY_NM", "법안가결"]),
    "청원": ("ranking_member", ["HG_NM", "POLY_NM", "청원제시", "청원결과"]),
    "위원회": ("ranking_member", ["HG_NM", "POLY_NM", "위원회"]),
    "기권": ("ranking_member", ["HG_NM", "POLY_NM", "기권_무효"]),
    "무효": ("ranking_member", ["HG_NM", "POLY_NM", "기권_무효"]),
    "일치": ("ranking_member", ["HG_NM", "POLY_NM", "표결일치"]),
    "불일치": ("ranking_member", ["HG_NM", "POLY_NM", "표결불일치"]),
    "정당 요약": ("party_score", ["정당", "평균실적", "의원수", "가중점수"]),
    "정당 통계": ("party_statistics_kr", ["정당"]),
}
#유사 키워드
KEYWORD_SYNONYMS = {
    "총점":["실적", "총실적"],
    "출석": ["출석", "출결", "출석률", "출석현황"],
    "법안": ["법안", "입법", "안건", "발의"],
    "청원": ["청원", "국민청원", "청원제출","청원현황"],
    "위원회": ["위원회", "상임위", "소속위원회"],
    "기권": ["기권", "기권표", "무효", "무효표"],
    "일치": ["일치", "표결일치", "찬반일치", "찬성일치"],
    "불일치":["불일치","표결불일치","찬반불일치"],
    "정당 요약":["정당요약"],
    "정당 통계":["정당통계"],
}
def normalize_keywords(user_input):
    for canonical, variants in KEYWORD_SYNONYMS.items():
        for variant in variants:
            if variant in user_input:
                user_input = user_input.replace(variant, canonical)
    return user_input

# DB에서 해당 키워드 관련 데이터만 추출
def get_filtered_data(user_input):
    data = {}
    try:
        if user_input.strip() == "사용법":
            return JsonResponse({
                "response": (
                    "이 챗봇은 국회의원과 정당의 실적 데이터를 분석하여 제공합니다.\n"
                    "데이터는 열린국회 API 기반으로, 제22대 국회의원 299명과 주요 정당 8개의 통계를 포함합니다.\n\n"
                    "다음과 같은 질문이 가능합니다:\n"
                    "- 특정 의원의 실적: 예) '홍길동 총점', '홍길동 출석', '홍길동 법안'\n"
                    "- 특정 정당의 통계: 예) '더불어민주당 평균실적', '국민의힘 정당 통계'\n"
                    "- 청원, 위원회, 기권/무효, 표결일치 관련 질문도 가능합니다.\n\n"
                    "예시 질문:\n"
                    "• '김민수 출석'\n"
                    "• '국민의힘 법안가결'\n"
                    "• '정의당 청원결과'\n"
                    "• '표결일치율이 높은 의원'\n"
                    "• '정당 요약'\n\n"
                    "필요하신 내용을 자유롭게 질문해주세요."
                )
            })
        
        # 유사 표현 정규화
        user_input = normalize_keywords(user_input)

        for keyword, (table, columns) in KEYWORD_MAPPING.items():
            if keyword in user_input:
                if table == "performance_score":
                    with sqlite3.connect(RANKING_MEMBER) as conn:
                        conn.row_factory = sqlite3.Row
                        cur = conn.cursor()
                        cur.execute(f"SELECT {', '.join(columns)} FROM {table}")
                        data[table] = [dict(row) for row in cur.fetchall()]
                else:
                    with sqlite3.connect(RANKING_DB) as conn:
                        conn.row_factory = sqlite3.Row
                        cur = conn.cursor()
                        cur.execute(f"SELECT {', '.join(columns)} FROM {table}")
                        data[table] = [dict(row) for row in cur.fetchall()]
        return data
    except Exception as e:
        return {"error": str(e)}

@csrf_exempt
def chatbot_api(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_input = data.get("message", "")

            # 키워드 기반 데이터 필터링
            db_data = get_filtered_data(user_input)
            if "error" in db_data or not db_data:
                return JsonResponse({"response": "관련 데이터가 없습니다. 다른 질문을 부탁드립니다."})

            # system prompt
            system_prompt = """
너는 대한민국 국회의원과 정당의 실적 데이터를 분석하는 전문가 챗봇이야. 사용자 질문에 대해 정확하고 신뢰할 수 있는 데이터를 바탕으로 자연스럽고 명확한 한국어로 답변해야 해.

반드시 지켜야 할 지침:
1. DB에 존재하는 실제 데이터만 기반으로 답변해. 만들어내거나 과장하지 마.
    - 국회의원을 묻는 질문엔 'ranking_members' 테이블을 기준으로 삼아.
    - 정당을 묻는 질문엔 'party_score' 또는 'party_statistics_kr' 테이블을 기준으로 삼아.
    - 정당의 '평균실적', '가중점수', '의원수' 등은 'party_score' 테이블을 참고해.
    - 정당의 출석률, 기권률, 표결일치율 등의 세부정보는 'party_statistics_kr' 테이블을 참고해.
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
3. 의원 이름이 HG_NM칼럼에 존재하지 않으면 '이름을 조금 더 정확히 입력해주세요'라고 응답해.
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
15.사용자가 입력한 질문에서 정확한 키워드가 없을 경우, 의미가 유사한 단어로 매핑해서 판단하면 돼.
    -예를 들어 '출결'은 '출석'으로 간주하고, '입법'은 '법안'으로 해석해
    -의미가 가장 유사한 항목을 기반으로 분석 결과를 제공해
"""

            # 프롬프트 구성
            prompt = f"""
[질문과 관련된 데이터]
{json.dumps(db_data, ensure_ascii=False)}

사용자 질문: {user_input}
답변:
"""

            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": "whisper-large-v3",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ]
            }

            response = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            reply = response.json()["choices"][0]["message"]["content"]
            reply = reply.replace('\n', '<br>')

            return JsonResponse({"response": reply})

        except Exception as e:
            return JsonResponse({"response": f"오류: {str(e)}"})
    return JsonResponse({"response": "POST 요청을 보내주세요."})