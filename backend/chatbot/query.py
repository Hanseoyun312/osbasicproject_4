import sqlite3
import os

BASE_DIR = os.path.dirname(__file__)
MEMBER_DB = os.path.join(BASE_DIR, '..', 'ranking_members.db')
PARTY_DB = os.path.join(BASE_DIR, '..', 'ranking_parties.db')

# --- 국회의원 관련 ---
def handle_member_query(keywords):
    name = None
    metric = None

    for word in keywords:
        if len(word) >= 2 and is_korean_name(word):
            name = word
        elif word in ["출석", "청원", "법안", "기권", "표결", "위원회", "가결", "불일치", "일치", "총점"]:
            metric = word

    if not name:
        return None

    try:
        with sqlite3.connect(MEMBER_DB) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM ranking_members WHERE HG_NM = ?", (name,))
            row = cursor.fetchone()

            if not row:
                return None

            columns = [desc[0] for desc in cursor.description]
            result = dict(zip(columns, row))

            if metric and metric in result:
                return {name: {metric: result.get(metric)}}
            else:
                return {name: result}

    except Exception as e:
        return {"error": str(e)}

# --- 정당 관련 ---
def handle_party_query(keywords):
    party = None
    metric = None

    for word in keywords:
        if word in ["더불어민주당", "국민의힘", "무소속", "정의당", "개혁신당", "조국혁신당"]:
            party = word
        elif word in ["출석", "기권", "표결", "불일치", "총점", "평균", "위원회", "청원"]:
            metric = word

    if not party:
        return None

    try:
        with sqlite3.connect(PARTY_DB) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM party_statistics_kr WHERE 정당 = ?", (party,))
            row = cursor.fetchone()

            if not row:
                return None

            columns = [desc[0] for desc in cursor.description]
            result = dict(zip(columns, row))

            if metric:
                # metric이 컬럼명과 정확히 일치하지 않을 수 있음 (매핑 추가 가능)
                match_column = next((col for col in result if metric in col), None)
                if match_column:
                    return {party: {match_column: result.get(match_column)}}

            return {party: result}

    except Exception as e:
        return {"error": str(e)}

# --- 기타 질문 ---
def handle_general_query(keywords):
    return {"message": "죄송합니다. 아직 학습되지 않은 주제입니다. '국회의원' 또는 '정당' 관련 질문을 해주세요."}

# --- 보조 함수 ---
def is_korean_name(text):
    # 간단한 한국 이름 감지 (2~4 글자 한글)
    return all('가' <= ch <= '힣' for ch in text) and 2 <= len(text) <= 4
