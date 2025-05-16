import sqlite3
import json
from collections import defaultdict

# --- 개별 점수 계산 함수들 ---

def get_attendance_score(name, total_bills=657):
    conn = sqlite3.connect("vote_summary.db")
    cur = conn.cursor()
    cur.execute("SELECT 총투표 FROM vote_summary WHERE HG_NM = ?", (name,))
    row = cur.fetchone()
    conn.close()
    return round(row[0] / total_bills * 100, 2) if row and row[0] else 0.0

def get_invalid_vote_ratio(name):
    conn = sqlite3.connect("vote_summary.db")
    cur = conn.cursor()
    cur.execute("SELECT 기권률 FROM vote_summary WHERE HG_NM = ?", (name,))
    row = cur.fetchone()
    conn.close()
    return round(row[0], 2) if row else 0.0

def get_vote_match_ratio(name):
    conn = sqlite3.connect("vote_summary.db")
    cur = conn.cursor()
    cur.execute("""
        SELECT 찬성_가결 + 반대_부결, 찬성 + 반대
        FROM vote_summary WHERE HG_NM = ?
    """, (name,))
    row = cur.fetchone()
    conn.close()
    if row and row[1]:
        return round(row[0] / row[1] * 100, 2)
    return 0.0

def get_vote_mismatch_ratio(name):
    conn = sqlite3.connect("vote_summary.db")
    cur = conn.cursor()
    cur.execute("""
        SELECT 찬성_부결 + 반대_가결, 찬성 + 반대
        FROM vote_summary WHERE HG_NM = ?
    """, (name,))
    row = cur.fetchone()
    conn.close()
    if row and row[1]:
        return round(row[0] / row[1] * 100, 2)
    return 0.0

def get_petition_score(name):
    with open("petition_introducer.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    return sum(1 for item in data["ncryefyuaflxnqbqo"] if item.get("INTD_ASBLM_NM") == name)

def get_petition_result_score(name):
    with open("petition_introducer.json", "r", encoding="utf-8") as f:
        introducer_data = json.load(f)
    with open("petition.json", "r", encoding="utf-8") as f:
        result_data = json.load(f)

    bills_by_name = {
        item["BILL_ID"]
        for item in introducer_data["ncryefyuaflxnqbqo"]
        if item.get("INTD_ASBLM_NM") == name
    }

    return sum(
        1
        for item in result_data["ncryefyuaflxnqbqo"]
        if item.get("BILL_ID") in bills_by_name and item.get("PROC_RESULT_CD") == "본회의가결"
    )

def get_committee_score(name):
    with open("committee.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    for item in data.get("committee_members", []):
        if item.get("HG_NM") == name and item.get("JOB_RES_NM") == "위원장":
            return 1
    return 0

def get_bill_pass_score(name):
    conn = sqlite3.connect("vote_summary.db")
    cur = conn.cursor()
    cur.execute("SELECT 찬성_가결 FROM vote_summary WHERE HG_NM = ?", (name,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row and row[0] is not None else 0.0

# --- 전체 실적 점수 계산 ---

def calculate_performance_scores(
    attendance_weight=-10.0,
    bill_passed_weight=50.0,
    petition_proposed_weight=15.5,
    petition_result_weight=30.5,
    committee_weight=5.0,
    invalid_or_abstain_weight=-2.5,
    vote_match_weight=7.5,
    vote_mismatch_weight=4.0
):
    conn = sqlite3.connect("vote_summary.db")
    cur = conn.cursor()
    cur.execute("SELECT HG_NM FROM vote_summary")
    all_lawmakers = [row[0] for row in cur.fetchall()]
    conn.close()

    performance = {}

    for lawmaker in all_lawmakers:
        attendance_score = get_attendance_score(lawmaker)
        bill_score = get_bill_pass_score(lawmaker)
        petition_score = get_petition_score(lawmaker)
        petition_result_score = get_petition_result_score(lawmaker)
        committee_score = get_committee_score(lawmaker)
        invalid_vote_score = get_invalid_vote_ratio(lawmaker)
        vote_match_score = get_vote_match_ratio(lawmaker)
        vote_mismatch_score = get_vote_mismatch_ratio(lawmaker)

        total_score = (
            attendance_score * attendance_weight +
            bill_score * bill_passed_weight +
            petition_score * petition_proposed_weight +
            petition_result_score * petition_result_weight +
            committee_score * committee_weight +
            invalid_vote_score * invalid_or_abstain_weight +
            vote_match_score * vote_match_weight +
            vote_mismatch_score * vote_mismatch_weight
        )

        performance[lawmaker] = {
            "총점": round(total_score, 2),
            "출석": attendance_score,
            "법안가결": bill_score,
            "청원제시": petition_score,
            "청원결과": petition_result_score,
            "위원회": committee_score,
            "기권/무효": invalid_vote_score,
            "표결일치": vote_match_score,
            "표결불일치": vote_mismatch_score
        }

    # DB 저장
    conn = sqlite3.connect("performance.db")
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS performance_score")
    cursor.execute("""
        CREATE TABLE performance_score (
            HG_NM TEXT PRIMARY KEY,
            총점 REAL,
            출석 REAL,
            법안가결 REAL,
            청원제시 REAL,
            청원결과 REAL,
            위원회 REAL,
            기권_무효 REAL,
            표결일치 REAL,
            표결불일치 REAL
        )
    """)

    for name, scores in performance.items():
        cursor.execute("""
            INSERT INTO performance_score VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            name,
            scores["총점"],
            scores["출석"],
            scores["법안가결"],
            scores["청원제시"],
            scores["청원결과"],
            scores["위원회"],
            scores["기권/무효"],
            scores["표결일치"],
            scores["표결불일치"]
        ))

    conn.commit()
    conn.close()
    print("🎯 총 실적 점수가 'performance.db'에 저장되었습니다.")

# --- 실행 진입점 ---

if __name__ == "__main__":
    try:
        calculate_performance_scores()
    except Exception as e:
        print("🚨 에러 발생:", e)
