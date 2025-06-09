import requests
import json
import math

api_url = "https://open.assembly.go.kr/portal/openapi/nktulghcadyhmiqxi"
api_key = "927928bf24af47d4afa7b805ed0bf4fc"

p_size = 1000
params = {
    "KEY": api_key,
    "Type": "json",
    "pIndex": 1,
    "pSize": p_size
}

# 전체 데이터를 저장할 리스트
all_rows = []

print("📡 첫 페이지 호출 중...")
response = requests.get(api_url, params=params)
data = response.json()

try:
    list_total_count = data["nktulghcadyhmiqxi"][0]["head"][0]["list_total_count"]
    total_pages = math.ceil(list_total_count / p_size)
    print(f"총 {list_total_count}건, {total_pages}페이지 처리 예정")

    for page in range(1, total_pages + 1):
        print(f"📄 {page}/{total_pages} 페이지 수집 중...")
        params["pIndex"] = page
        response = requests.get(api_url, params=params)
        data = response.json()
        rows = data["nktulghcadyhmiqxi"][1].get("row", [])
        all_rows.extend(rows)

    # 필터링
    target_fields = ["DEPT_NM", "JOB_RES_NM", "HG_NM", "POLY_NM", "MONA_CD"]
    filtered_rows = [
        {field: row.get(field, "") for field in target_fields} for row in all_rows
    ]

    with open("committee.json", "w", encoding="utf-8") as f:
        json.dump({"committee_members": filtered_rows}, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 총 {len(filtered_rows)}명의 위원회 위원 명단이 'committee.json'에 저장되었습니다.")

except Exception as e:
    print("❌ 오류 발생:", str(e))
