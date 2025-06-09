import requests
import json
import math

# API 기본 정보
api_key = "927928bf24af47d4afa7b805ed0bf4fc"
api_url = "https://open.assembly.go.kr/portal/openapi/nkalemivaqmoibxro"  # 요청 주소

# API 요청 파라미터 설정
params = {
    "KEY": api_key,
    "Type": "json",
    "pIndex": "1",
    "pSize": "1000",
    "AGE": "22"  # 22대 국회
}

# 전체 데이터를 저장할 리스트
all_data = []

# 첫 페이지 호출
print("📡 첫 페이지 호출 중...")
response = requests.get(api_url, params=params)

if response.status_code == 200:
    try:
        # JSON 형식으로 변환
        data = response.json()

        # API 이름 추출 (URL에서)
        api_name = api_url.split('/')[-1]

        # 일반적인 API 응답 구조 처리
        if api_name in data:
            api_data = data[api_name]

            if isinstance(api_data, list) and len(api_data) > 1:
                # 두 번째 항목에서 'row' 데이터 추출
                second_item = api_data[1]

                if isinstance(second_item, dict) and 'row' in second_item:
                    rows = second_item['row']
                    print(f"총 {len(rows)}개의 데이터를 가져왔습니다.")

                    # 전체 데이터의 개수를 가져옵니다.
                    list_total_count = data[api_name][0]["head"][0]["list_total_count"]
                    total_pages = math.ceil(list_total_count / 1000)
                    print(f"전체 데이터: {list_total_count}건, 총 {total_pages}페이지 처리 예정")

                    # 첫 페이지부터 끝 페이지까지 반복 요청
                    for page in range(1, total_pages + 1):
                        print(f"📄 {page}/{total_pages} 페이지 호출 중...")
                        params["pIndex"] = str(page)
                        response = requests.get(api_url, params=params)
                        data = response.json()

                        # 새로운 데이터 추출
                        second_item = data[api_name][1]
                        rows = second_item.get('row', [])
                        all_data.extend(rows)

                    # PROC_RESULT_CD와 BILL_ID만 추출
                    filtered_data = []
                    for row in all_data:
                        re = row.get("PROC_RESULT_CD", "")
                        age=row.get("AGE","")
                        bill_id = row.get("BILL_ID", "")
                        filtered_data.append({
                            "age":age,
                            "PROC_RESULT_CD": re,
                            "BILL_ID": bill_id
                        })

                    # 결과를 JSON 파일로 저장
                    output_data = {"data": filtered_data}
                    with open("cost.json", "w", encoding="utf-8") as f:
                        json.dump(output_data, f, ensure_ascii=False, indent=2)
                    print(f"\n{len(filtered_data)}개의 정보가 'cost.json' 파일로 저장되었습니다.")

                else:
                    print("'row' 키를 찾을 수 없습니다.")
            else:
                print("API 응답 구조가 예상과 다릅니다.")
        else:
            print("예상치 못한 응답 구조입니다.")

    except json.JSONDecodeError:
        print("JSON 파싱 오류. 응답이 JSON 형식이 아닙니다.")
        print("응답 내용:")
        print(response.text[:500])

else:
    print(f"API 요청 실패: {response.status_code}")
    print("응답 내용:")
    print(response.text[:500])
