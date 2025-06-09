import requests
import json
import os
import time
import sqlite3

api_key = "927928bf24af47d4afa7b805ed0bf4fc"
vote_api_url = "https://open.assembly.go.kr/portal/openapi/nojepdqqaweusdfbi"

# SQLite DB 경로
DB_PATH = "votes.db"

# BILL_ID 목록 가져오기
def get_bill_ids_from_file():
    filename_list = {
        "all": "all.json",
        "law": "law.json",
        "cost": "cost.json",
        "cosstly": "cosstly.json",
        "etc": "etc.json"
    }

    bill_ids_list = {}
    for key, filename in filename_list.items():
        if not os.path.exists(filename):
            print(f"파일 '{filename}'이 존재하지 않습니다.")
            continue
        with open(filename, "r", encoding="utf-8") as f:
            file_data = json.load(f)
        bill_ids = [item["BILL_ID"] for item in file_data.get("data", []) if "BILL_ID" in item]
        bill_ids_list[key] = bill_ids
    return bill_ids_list

# API 호출
def get_vote_data(bill_id):
    params = {
        "KEY": api_key,
        "Type": "json",
        "pIndex": "1",
        "pSize": "1000",
        "AGE": "22",
        "BILL_ID": bill_id
    }

    try:
        response = requests.get(vote_api_url, params=params)
        if response.status_code != 200:
            return []
        data = response.json()
        api_name = vote_api_url.split('/')[-1]

        if api_name not in data:
            return []

        rows = data[api_name][1].get("row", [])
        field_map = {}
        example = rows[0] if rows else {}

        expected_fields = {
            "HG_NM": ["HG_NM", "MONA_NM", "NAMES"],
            "POLY_NM": ["POLY_NM", "PARTY_NM"],
            "BILL_ID": ["BILL_ID"],
            "BILL_NAME": ["BILL_NAME", "BILL_TITLE"],
            "RESULT_VOTE_MOD": ["RESULT_VOTE_MOD", "RESULT"],
            "BILL_NO": ["BILL_NO"],
            "VOTE_DATE": ["VOTE_DATE"]
        }

        for key, candidates in expected_fields.items():
            for candidate in candidates:
                if candidate in example:
                    field_map[key] = candidate
                    break

        filtered = []
        for row in rows:
            record = {}
            for key, actual in field_map.items():
                record[key] = row.get(actual, "")
            filtered.append(record)
        return filtered

    except Exception as e:
        print(f"API 오류: {e}")
        return []

# SQLite 테이블 생성
def setup_database():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS votes (
        HG_NM TEXT,
        POLY_NM TEXT,
        BILL_ID TEXT,
        BILL_NAME TEXT,
        RESULT_VOTE_MOD TEXT,
        BILL_NO TEXT,
        VOTE_DATE TEXT,
        PRIMARY KEY (HG_NM, BILL_ID)
    )
    """)
    conn.commit()
    conn.close()

# 데이터 저장
def save_votes_to_db(votes):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    with conn:  # 트랜잭션 블록
        cursor.executemany("""
        REPLACE INTO votes (HG_NM, POLY_NM, BILL_ID, BILL_NAME, RESULT_VOTE_MOD, BILL_NO, VOTE_DATE)
        VALUES (:HG_NM, :POLY_NM, :BILL_ID, :BILL_NAME, :RESULT_VOTE_MOD, :BILL_NO, :VOTE_DATE)
        """, votes)
    conn.close()

# 메인 실행
def main():
    setup_database()
    bill_ids_dict = get_bill_ids_from_file()
    if not bill_ids_dict:
        print("BILL_ID 목록 없음.")
        return

    for filename, bill_ids in bill_ids_dict.items():
        print(f"\n=== {filename} 처리 시작 ===")
        for i, bill_id in enumerate(bill_ids):
            votes = get_vote_data(bill_id)
            if votes:
                save_votes_to_db(votes)
                print(f"[{filename}] BILL_ID {bill_id} → {len(votes)}건 저장됨")
            time.sleep(1)

    print("\n✅ 모든 투표 데이터가 SQLite DB에 저장되었습니다!")

if __name__ == "__main__":
    main()
