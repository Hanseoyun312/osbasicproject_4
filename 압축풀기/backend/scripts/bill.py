import requests
import json
import math

api_key = "927928bf24af47d4afa7b805ed0bf4fc"
api_url = "https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn"
age = "22"
p_size = 1000

# 전체 데이터 저장 리스트
all_bills = []

# 첫 페이지에서 전체 개수 파악
params = {
    "KEY": api_key,
    "Type": "json",
    "pIndex": 1,
    "pSize": p_size,
    "AGE": age
}
print("📡 첫 페이지 호출 중...")
resp = requests.get(api_url, params=params)
data = resp.json()

try:
    list_total_count = data["nzmimeepazxkubdpn"][0]["head"][0]["list_total_count"]
    total_pages = math.ceil(list_total_count / p_size)
    print(f"총 {list_total_count}건의 데이터, {total_pages}페이지")

    # 각 페이지 반복 요청
    for page in range(1, total_pages + 1):
        print(f"📄 {page}/{total_pages} 페이지 처리 중...")
        params["pIndex"] = page
        resp = requests.get(api_url, params=params)
        data = resp.json()
        rows = data["nzmimeepazxkubdpn"][1].get("row", [])

        for row in rows:
            bill_id = row.get("BILL_ID", "")
            main_proposer = row.get("RST_PROPOSER", "")
            co_proposers_raw = row.get("PUBL_PROPOSER")
            proc_result = row.get("PROC_RESULT", "")  # 본회의 처리 결과

            co_proposers = []
            if isinstance(co_proposers_raw, str):
                co_proposers = [name.strip() for name in co_proposers_raw.split(",") if name.strip()]

            all_bills.append({
                "BILL_ID": bill_id,
                "MAIN_PROPOSER": main_proposer,
                "CO_PROPOSERS": co_proposers,
                "PROC_RESULT": proc_result  # 여기에 본회의 처리 결과 포함
            })

    # JSON 저장
    with open("bill.json", "w", encoding="utf-8") as f:
        json.dump({"bills": all_bills}, f, ensure_ascii=False, indent=2)

    print(f"✅ 총 {len(all_bills)}개의 의안이 저장되었습니다.")

except Exception as e:
    print("❌ 처리 중 오류 발생:", str(e))
