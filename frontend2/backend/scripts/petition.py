import requests
import json

# 1. API URL 설정
api_url = "https://open.assembly.go.kr/portal/openapi/ncryefyuaflxnqbqo"

# 2. API 키 설정
api_key = "927928bf24af47d4afa7b805ed0bf4fc"

# 3. 요청 파라미터 설정
params = {
    "KEY": api_key,
    "Type": "json",
    "pIndex": "1",
    "pSize": "1000",
    "AGE": "22"  # 22대만 조회
}

# 4. 여러 페이지에 걸쳐 데이터 받기
page_num = 1
all_data = []

while True:
    params['pIndex'] = str(page_num)
    response = requests.get(api_url, params=params)

    if response.status_code == 200:
        data = response.json()
        if 'ncryefyuaflxnqbqo' in data and isinstance(data['ncryefyuaflxnqbqo'], list):
            api_list = data['ncryefyuaflxnqbqo']
            
            if len(api_list) > 1:
                second_item = api_list[1]
                if isinstance(second_item, dict) and 'row' in second_item:
                    rows = second_item['row']
                    
                    if len(rows) == 0:
                        break
                    
                    all_data.extend(rows)
                    page_num += 1
                else:
                    break
            else:
                break
        else:
            break
    else:
        break

# 5. 필요한 필드만 추출 (BILL_ID 포함)
target_fields = ["BILL_ID", "BILL_NO", "BILL_NAME", "PROPOSER", "PROC_RESULT_CD"]
filtered_rows = [{field: row.get(field, "") for field in target_fields} for row in all_data]

# 6. 파일로 저장
output = {"ncryefyuaflxnqbqo": filtered_rows}
with open("petition.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

# 7. 개수 출력
print(f"\n총 {len(filtered_rows)}개의 데이터를 받아와 'petition.json'에 저장했습니다.")
