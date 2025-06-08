import re

def classify_question(question):
    question = question.strip()

    # 소문자로 일단 통일
    q_lower = question.lower()

    # 1. 주제 분류
    if any(word in question for word in ["의원", "출석", "법안", "표결", "청원", "이재명", "김기현"]):
        topic = "국회의원"
    elif any(word in question for word in ["정당", "국민의힘", "민주당", "무소속", "당 평균"]):
        topic = "정당"
    else:
        topic = "기타"

    # 2. 키워드 추출
    # 한글 이름 추출
    name_pattern = r"[가-힣]{2,4}"
    names = re.findall(name_pattern, question)

    # 성능 관련 단어
    metric_keywords = ["출석", "청원", "법안", "기권", "표결", "위원회", "가결", "무효", "불일치", "일치", "총점", "평균", "등수", "순위"]

    matched_metrics = [word for word in metric_keywords if word in question]

    keywords = names + matched_metrics

    return topic, keywords
