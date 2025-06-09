import sqlite3
import math
import statistics
from collections import defaultdict

def calculate_party_performance_and_save():
    conn = sqlite3.connect("performance.db")
    cur = conn.cursor()
    cur.execute("SELECT HG_NM, POLY_NM, 총점 FROM performance_score")
    rows = cur.fetchall()
    conn.close()

    party_scores = defaultdict(list)
    for name, party, score in rows:
        if party:
            party_scores[party].append(score)

    party_rankings = []
    for party, scores in party_scores.items():
        avg = sum(scores) / len(scores)
        weighted = round(avg * math.log(len(scores) + 1), 2)
        party_rankings.append((party, round(avg, 2), len(scores), weighted))

    party_rankings.sort(key=lambda x: x[3], reverse=True)

    conn = sqlite3.connect("ranking.db")
    cur = conn.cursor()
    cur.execute("DROP TABLE IF EXISTS party_score")
    cur.execute("""
        CREATE TABLE party_score (
            POLY_NM TEXT PRIMARY KEY,
            평균실적 REAL,
            의원수 INTEGER,
            가중점수 REAL
        )
    """)
    for poly_nm, avg_score, count, weighted_score in party_rankings:
        cur.execute("INSERT INTO party_score VALUES (?, ?, ?, ?)", (poly_nm, avg_score, count, weighted_score))

    conn.commit()
    conn.close()
    print("✅ 정당별 실적 점수가 'ranking.db'에 저장되었습니다 (party_score).")


def summarize_party_statistics_to_db_kr():
    conn = sqlite3.connect("performance.db")
    cur = conn.cursor()
    cur.execute("""
        SELECT POLY_NM, 출석, 법안가결, 청원제시, 청원결과, 위원회, 기권_무효, 표결일치, 표결불일치
        FROM performance_score
    """)
    rows = cur.fetchall()
    conn.close()

    stats = defaultdict(lambda: defaultdict(list))
    for row in rows:
        party = row[0]
        if not party:
            continue
        stats[party]["출석"].append(row[1])
        stats[party]["법안가결"].append(row[2])
        stats[party]["청원제시"].append(row[3])
        stats[party]["청원결과"].append(row[4])
        stats[party]["위원회"].append(row[5])
        stats[party]["기권_무효"].append(row[6])
        stats[party]["표결일치"].append(row[7])
        stats[party]["표결불일치"].append(row[8])

    conn = sqlite3.connect("ranking.db")  # ✅ 같은 DB 사용
    cur = conn.cursor()
    cur.execute("DROP TABLE IF EXISTS party_statistics_kr")
    cur.execute("""
        CREATE TABLE party_statistics_kr (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            정당 TEXT,
            출석_평균 REAL,
            출석_최고 REAL,
            출석_최저 REAL,
            출석_표준편차 REAL,
            기권무효_평균 REAL,
            기권무효_최고 REAL,
            기권무효_최저 REAL,
            기권무효_표준편차 REAL,
            표결일치_평균 REAL,
            표결일치_최고 REAL,
            표결일치_최저 REAL,
            표결일치_표준편차 REAL,
            표결불일치_평균 REAL,
            표결불일치_최고 REAL,
            표결불일치_최저 REAL,
            표결불일치_표준편차 REAL,
            법안가결_총합 INTEGER,
            청원제시_총합 INTEGER,
            청원결과_총합 INTEGER,
            위원회_총합 REAL
        )
    """)

    for party, data in stats.items():
        try:
            출석평균 = statistics.mean(data["출석"])
            출석최고 = max(data["출석"])
            출석최저 = min(data["출석"])
            출석표준편차 = statistics.stdev(data["출석"]) if len(data["출석"]) > 1 else 0

            기권평균 = statistics.mean(data["기권_무효"])
            기권최고 = max(data["기권_무효"])
            기권최저 = min(data["기권_무효"])
            기권표준편차 = statistics.stdev(data["기권_무효"]) if len(data["기권_무효"]) > 1 else 0

            표결일치평균 = statistics.mean(data["표결일치"])
            표결일치최고 = max(data["표결일치"])
            표결일치최저 = min(data["표결일치"])
            표결일치표준편차 = statistics.stdev(data["표결일치"]) if len(data["표결일치"]) > 1 else 0

            표결불일치평균 = statistics.mean(data["표결불일치"])
            표결불일치최고 = max(data["표결불일치"])
            표결불일치최저 = min(data["표결불일치"])
            표결불일치표준편차 = statistics.stdev(data["표결불일치"]) if len(data["표결불일치"]) > 1 else 0

            법안가결합 = sum(data["법안가결"])
            청원제시합 = sum(data["청원제시"])
            청원결과합 = sum(data["청원결과"])
            위원회합 = sum(data["위원회"])

            cur.execute("""
                INSERT INTO party_statistics_kr VALUES (
                    NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            """, (
                party,
                출석평균, 출석최고, 출석최저, 출석표준편차,
                기권평균, 기권최고, 기권최저, 기권표준편차,
                표결일치평균, 표결일치최고, 표결일치최저, 표결일치표준편차,
                표결불일치평균, 표결불일치최고, 표결불일치최저, 표결불일치표준편차,
                법안가결합, 청원제시합, 청원결과합, 위원회합
            ))
        except Exception as e:
            print(f"❌ 에러 발생 {party}: {e}")

    conn.commit()
    conn.close()
    print("✅ 정당별 통계가 'ranking.db'에 저장되었습니다 (party_statistics_kr).")

if __name__ == "__main__":
    calculate_party_performance_and_save()
    summarize_party_statistics_to_db_kr()
