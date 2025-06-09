import json
import glob
import sqlite3
from collections import defaultdict

def summarize_votes_with_official_filter():
    # ✅ 공식 22대 국회의원 이름 목록 로딩
    with open("filtered_members.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        official_names = {
            member.get("HG_NM", "").strip()
            for member in data.get("nwvrqwxyaytdsfvhu", [])
            if member.get("HG_NM", "").strip()
        }

    # ✅ 안건 결과 로딩
    result_files = ["all.json", "cost.json", "cosstly.json", "etc.json", "law.json"]
    bill_results = {}
    for file in result_files:
        with open(file, "r", encoding="utf-8") as f:
            file_data = json.load(f)
            for bill in file_data.get("data", []):
                bill_id = bill.get("BILL_ID")
                result = bill.get("PROC_RESULT_CD")
                if bill_id and result:
                    bill_results[bill_id] = result

    summary = defaultdict(lambda: {
        "찬성": 0, "반대": 0, "기권": 0,
        "찬성-가결": 0, "찬성-부결": 0,
        "반대-가결": 0, "반대-부결": 0,
        "기타": 0
    })

    seen_votes = set()
    bill_ids_set = set()

    vote_files = glob.glob("vote_*.json")
    print(f"총 {len(vote_files)}개의 vote_*.json 파일 처리 중...")

    for filename in vote_files:
        with open(filename, "r", encoding="utf-8") as f:
            data = json.load(f)

        for vote in data.get("vote_data", []):
            name = vote.get("HG_NM", "").strip()
            result = vote.get("RESULT_VOTE_MOD")
            bill_id = vote.get("BILL_ID")

            # ✅ 공식 명단 필터링
            if name not in official_names:
                continue

            if result not in ["찬성", "반대", "기권"] or not bill_id:
                continue

            key = (name, bill_id)
            if key in seen_votes:
                continue
            seen_votes.add(key)

            summary[name][result] += 1
            bill_ids_set.add(bill_id)

            proc_result = bill_results.get(bill_id)
            if proc_result:
                if result == "찬성":
                    if "가결" in proc_result:
                        summary[name]["찬성-가결"] += 1
                    elif "부결" in proc_result:
                        summary[name]["찬성-부결"] += 1
                    else:
                        summary[name]["기타"] += 1
                elif result == "반대":
                    if "가결" in proc_result:
                        summary[name]["반대-가결"] += 1
                    elif "부결" in proc_result:
                        summary[name]["반대-부결"] += 1
                    else:
                        summary[name]["기타"] += 1
                else:
                    summary[name]["기타"] += 1
            else:
                summary[name]["기타"] += 1

    # ✅ DB 저장
    conn = sqlite3.connect("vote_summary.db")
    cursor = conn.cursor()

    cursor.execute("DROP TABLE IF EXISTS vote_summary")
    cursor.execute("""
        CREATE TABLE vote_summary (
            HG_NM TEXT PRIMARY KEY,
            찬성 INTEGER,
            반대 INTEGER,
            기권 INTEGER,
            총투표 INTEGER,
            찬성률 REAL,
            반대률 REAL,
            기권률 REAL,
            찬성_가결 INTEGER,
            찬성_부결 INTEGER,
            반대_가결 INTEGER,
            반대_부결 INTEGER,
            기타 INTEGER
        )
    """)

    count = 0
    for name, counts in summary.items():
        total = counts["찬성"] + counts["반대"] + counts["기권"]
        if total == 0:
            continue
        cursor.execute("""
            INSERT INTO vote_summary (
                HG_NM, 찬성, 반대, 기권, 총투표,
                찬성률, 반대률, 기권률,
                찬성_가결, 찬성_부결, 반대_가결, 반대_부결, 기타
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            name,
            counts["찬성"],
            counts["반대"],
            counts["기권"],
            total,
            round(counts["찬성"] / total * 100, 2),
            round(counts["반대"] / total * 100, 2),
            round(counts["기권"] / total * 100, 2),
            counts["찬성-가결"],
            counts["찬성-부결"],
            counts["반대-가결"],
            counts["반대-부결"],
            counts["기타"]
        ))
        count += 1

    conn.commit()
    conn.close()

    print(f"✅ 공식 명단 기반 {count}명 저장 완료 (vote_summary.db)")
    print(f"📊 총 처리된 안건 수: {len(bill_ids_set)}")

# 실행
summarize_votes_with_official_filter()
