import sqlite3

def query_performance_scores(order='desc', limit=10):
    """
    총 실적 점수를 기준으로 정렬하여 출력합니다.
    
    :param order: 'asc' 또는 'desc'. 기본은 'desc' (높은 점수 순).
    :param limit: 출력할 인원 수. 기본은 10명.
    """
    if order not in ('asc', 'desc'):
        print("⚠️ 정렬 방식은 'asc' 또는 'desc' 중 하나여야 합니다.")
        return

    conn = sqlite3.connect("performance.db")
    cur = conn.cursor()

    query = f"""
        SELECT HG_NM, 총점 FROM performance_score
        ORDER BY 총점 {order.upper()}
        LIMIT ?
    """
    cur.execute(query, (limit,))
    rows = cur.fetchall()
    conn.close()

    order_label = "낮은 순" if order == 'asc' else "높은 순"
    print(f"\n📊 총 실적 점수 ({order_label}) 상위 {limit}명")

    for i, (name, score) in enumerate(rows, 1):
        print(f"{i}. {name}: {score}점")

#실행 예시
query_performance_scores()                 # 기본값, 높은 순으로 상위 10명
query_performance_scores(order='asc')     # 낮은 순으로 상위 10명
query_performance_scores(limit=20)        # 높은 순으로 상위 20명
query_performance_scores(order='asc', limit=5)  # 낮은 순으로 상위 5명

