import os
import sqlite3
import re
import json
import requests

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render

# OpenRouter API 예시 (키는 환경변수 등록)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# DB 경로 (절대경로 추천, 아니면 아래처럼 상대경로 조정)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RANKING_MEMBERS_DB = os.path.join(BASE_DIR, '..', 'ranking_members.db')
RANKING_PARTIES_DB = os.path.join(BASE_DIR, '..', 'ranking_parties.db')

# 의원/정당 이름 추출용 리스트 생성 (최초 1회만 로딩)
def get_all_names(db_path, column):
    with sqlite3.connect(db_path) as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT DISTINCT {column} FROM ranking_members" if 'member' in db_path else f"SELECT DISTINCT {column} FROM party_score")
        return [row[0] for row in cur.fetchall() if row[0]]

ALL_MEMBER_NAMES = get_all_names(RANKING_MEMBERS_DB, 'HG_NM')
ALL_PARTY_NAMES = get_all_names(RANKING_PARTIES_DB, '정당')

# 이름/정당 비표준 표현 정규화(오타 변환)
PARTY_ALIASES = {
    "국힘": "국민의힘", 
    "국민의 힘": "국민의힘", 
    "국힘당": "국민의힘",
    "민주당": "더불어민주당", 
    "더민주": "더불어민주당", 
    "더민주당": "더불어민주당",
    "더불어 민주당": "더불어민주당",
    "여당": "더불어민주당", 
    "조국당": "조국혁신당", 
    "혁신당": "조국혁신당", 
    "기본당": "기본소득당"
}

def normalize_party_name(name):
    for alias, true_name in PARTY_ALIASES.items():
        if alias in name:
            return true_name
    return name

# 질문에서 이름/정당 자동 추출
def extract_keywords(user_input):
    # 정당명 먼저
    for p in sorted(ALL_PARTY_NAMES + list(PARTY_ALIASES.keys()), key=len, reverse=True):
        if p and p in user_input:
            norm_p = normalize_party_name(p)
            return ('party', norm_p)
    # 의원명
    for n in sorted(ALL_MEMBER_NAMES, key=len, reverse=True):
        if n and n in user_input:
            return ('member', n)
    return (None, None)

# DB에서 row 추출
def get_row_from_db(mode, keyword):
    if mode == 'member':
        with sqlite3.connect(RANKING_MEMBERS_DB) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM ranking_members WHERE HG_NM LIKE ?", ('%' + keyword + '%',))
            row = cur.fetchone()
            return dict(row) if row else None
    elif mode == 'party':
        # party_score, party_statistics_kr 모두 조회
        with sqlite3.connect(RANKING_PARTIES_DB) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM party_score WHERE 정당 LIKE ?", ('%' + keyword + '%',))
            row1 = cur.fetchone()
            cur.execute("SELECT * FROM party_statistics_kr WHERE 정당 LIKE ?", ('%' + keyword + '%',))
            row2 = cur.fetchone()
            return {'party_score': dict(row1) if row1 else None, 'party_stats': dict(row2) if row2 else None}
    else:
        return None

# 메인 챗봇 API
@csrf_exempt
def chatbot_api(request):
    if request.method == "POST":
        try:
            req_data = json.loads(request.body)
            user_input = req_data.get("message", "")

            # 핵심: 질문에서 키워드 추출
            mode, keyword = extract_keywords(user_input)

            if not mode or not keyword:
                return JsonResponse({"response": "의원 또는 정당 이름을 조금 더 정확히 입력해 주세요."})

            # 해당 row만 추출
            db_data = get_row_from_db(mode, keyword)
            if not db_data or (isinstance(db_data, dict) and not any(db_data.values())):
                return JsonResponse({"response": "DB에 일치하는 정보가 없습니다."})

            # 프롬프트 구성
            system_prompt = """
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

            prompt = f"""
[질문 관련 데이터]
{json.dumps(db_data, ensure_ascii=False, indent=2)}

질문: {user_input}
답변:
"""

            # OpenRouter API 호출 (여기서 최신 무료 모델명 사용)
            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "mistralai/mistral-large",   # 추천: 무료/안정적, 바뀌면 최신 무료모델로 변경
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ]
            }
            response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=20)
            res_json = response.json()
            if "choices" in res_json:
                reply = res_json["choices"][0]["message"]["content"]
                return JsonResponse({"response": reply.replace('\n', '<br>')})
            else:
                return JsonResponse({"response": f"[오류] {res_json}"})

        except Exception as e:
            return JsonResponse({"response": f"오류: {str(e)}"})
    return JsonResponse({"response": "POST 요청을 보내주세요."})

def chatbot_page(request):
    return render(request, "chatbot/test.html")
