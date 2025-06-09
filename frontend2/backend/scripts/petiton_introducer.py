import requests
import json

# 1. API URL 설정 (소개의원명 조회용)
api_url = "https://open.assembly.go.kr/portal/openapi/PTTINFOPPSR"

# 2. API 키 설정
api_key = "927928bf24af47d4afa7b805ed0bf4fc"

# 3. 'petition.json' 파일 읽기
with open('petition.json', 'r', encoding='utf-8') as f:
    petition_data = json.load(f).get('ncryefyuaflxnqbqo', [])

# 4. BILL_ID를 PTT_ID로 사용해서 소개의원명 조회 및 추가
for petition in petition_data:
    bill_id = petition["BILL_ID"]

    params = {
        "KEY": api_key,
        "Type": "json",
        "PTT_ID": bill_id
    }

    response = requests.get(api_url, params=params)

    if response.status_code == 200:
        try:
            data = response.json()

            if "PTTINFOPPSR" in data and isinstance(data["PTTINFOPPSR"], list):
                if len(data["PTTINFOPPSR"]) > 1 and "row" in data["PTTINFOPPSR"][1]:
                    row = data["PTTINFOPPSR"][1]["row"]
                    if len(row) > 0:
                        proposer_name = row[0].get("INTD_ASBLM_NM", "조회 실패")
                        petition["INTD_ASBLM_NM"] = proposer_name
                    else:
                        petition["INTD_ASBLM_NM"] = "소개의원 없음"
                else:
                    petition["INTD_ASBLM_NM"] = "정보 없음"
            else:
                petition["INTD_ASBLM_NM"] = "정보 없음"
        except json.JSONDecodeError:
            petition["INTD_ASBLM_NM"] = "JSON 변환 실패"
    else:
        petition["INTD_ASBLM_NM"] = f"API 요청 실패: {response.status_code}"

# 5. 결과 확인 출력
print("\n최종 청원 결과:")
for petition in petition_data:
    print(f"{petition['BILL_NAME']} - 소개의원명: {petition.get('INTD_ASBLM_NM', '정보 없음')}")

# 6. 결과 저장 (다른 파일로 저장)
output_filename = 'petition_introducer.json'
with open(output_filename, 'w', encoding='utf-8') as f:
    json.dump({"ncryefyuaflxnqbqo": petition_data}, f, ensure_ascii=False, indent=2)

print(f"\n📁 '{output_filename}' 파일로 저장 완료.")
