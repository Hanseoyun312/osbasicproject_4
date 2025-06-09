import requests
import json
import math

api_key = "927928bf24af47d4afa7b805ed0bf4fc"
api_url = "https://open.assembly.go.kr/portal/openapi/nxjuyqnxadtotdrbw"
p_size = 1000
age = "22"

# 첫 페이지로 전체 개수 확인
params = {
    "KEY": api_key,
    "Type": "json",
    "pIndex": "1",
    "pSize": str(p_size),
    "AGE": age
}

print("📡 첫 페이지 호출 중...")
resp = requests.get(api_url, params=params)
data = resp.json()

all_rows = []

try:
    total_count = data[api_url.split("/")[-1]][0]['head'][0]['list_total_count']
    total_pages = math.ceil(total_count / p_size)
    print(f"총 {total_count}건, {total_pages} 페이지 처리 예정")

    for page in range(1, total_pages + 1):
        print(f"📄 {page}/{total_pages} 페이지 수집 중...")
        params["pIndex"] = str(page)
        resp = requests.get(api_url, params=params)
        data = resp.json()
        rows = data[api_url.split("/")[-1]][1].get("row", [])
        all_rows.extend(rows)

    # 필요한 필드만 추출
    filtered_data = []
    for row in all_rows:
        filtered_data.append({
            "AGE": row.get("AGE", ""),
            "BILL_ID": row.get("BILL_ID", ""),
            "PROC_RESULT_CD": row.get("PROC_RESULT_CD", ""),
            "PROPOSER": row.get("PROPOSER", ""),
            "DETAIL_LINK": row.get("LINK_URL", "")
        })

    with open("all.json", "w", encoding="utf-8") as f:
        json.dump({"data": filtered_data}, f, ensure_ascii=False, indent=2)

    print(f"✅ 총 {len(filtered_data)}건이 'all_meeting_bills_22nd.json'에 저장되었습니다.")

except Exception as e:
    print("❌ 오류 발생:", str(e))
