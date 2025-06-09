import requests
import json
import math

# 1. API URL 설정
api_url = "https://open.assembly.go.kr/portal/openapi/nwbpacrgavhjryiph"

# 2. API 키 설정
api_key = "927928bf24af47d4afa7b805ed0bf4fc"

# 3. 요청 파라미터 설정 (AGE=22만 포함)
params = {
    "KEY": api_key,
    "Type": "json",
    "pIndex": "1",  # 첫 페이지 요청
    "pSize": "1000",  # 최대 1000개 요청
    "AGE": "22"   # 22대 의안만
}

# 4. 전체 데이터를 저장할 리스트
all_data = []

# 5. 첫 페이지 요청
response = requests.get(api_url, params=params)

# 6. 응답 분석 및 필터링
if response.status_code == 200:
    try:
        data = response.json()

        if 'nwbpacrgavhjryiph' in data and isinstance(data['nwbpacrgavhjryiph'], list):
            api_list = data['nwbpacrgavhjryiph']

            if len(api_list) > 1:
                second_item = api_list[1]

                if isinstance(second_item, dict) and 'row' in second_item:
                    rows = second_item['row']
                    print(f"'row' 데이터 수: {len(rows)}")

                    # 전체 데이터의 개수를 가져옵니다.
                    list_total_count = data['nwbpacrgavhjryiph'][0]['head'][0]['list_total_count']
                    total_pages = math.ceil(list_total_count / 1000)
                    print(f"전체 데이터: {list_total_count}건, 총 {total_pages}페이지 처리 예정")

                    # 첫 페이지부터 끝 페이지까지 반복 요청
                    for page in range(1, total_pages + 1):
                        print(f"📄 {page}/{total_pages} 페이지 호출 중...")
                        params["pIndex"] = str(page)
                        response = requests.get(api_url, params=params)
                        data = response.json()

                        # 새로운 데이터 추출
                        second_item = data['nwbpacrgavhjryiph'][1]
                        rows = second_item.get('row', [])
                        all_data.extend(rows)

                    # 필요한 필드만 추출
                    target_fields = ["BILL_ID","BILL_NO", "BILL_NM", "PROPOSER", "PROC_RESULT_CD", "ANNOUNCE_DT"]
                    
                    filtered_rows = []
                    for row in all_data:
                        filtered_row = {field: row.get(field, "") for field in target_fields}
                        filtered_rows.append(filtered_row)

                    # 필터링된 데이터 저장
                    filtered_data = {
                        "data": filtered_rows
                    }

                    # JSON 파일로 저장
                    with open("law.json", "w", encoding="utf-8") as f:
                        json.dump(filtered_data, f, ensure_ascii=False, indent=2)
                    print("\n📁 'law.json' 파일로 저장 완료.")
                else:
                    print("'row' 키가 없거나 형식이 올바르지 않습니다.")
            else:
                print("API 응답에 유효한 데이터가 없습니다.")
        else:
            print("'nwbpacrgavhjryiph' 키를 찾을 수 없거나 리스트가 아닙니다.")
    except json.JSONDecodeError:
        print("⚠️ JSON 변환 실패. 응답 내용:")
        print(response.text[:1000])
else:
    print(f"API 요청 실패: {response.status_code}")
    print(response.text[:1000])
