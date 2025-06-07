import requests
import math
from .models import Law

def fetch_and_save_law():
    api_url = "https://open.assembly.go.kr/portal/openapi/nwbpacrgavhjryiph"
    api_key = "927928bf24af47d4afa7b805ed0bf4fc"

    params = {
        "KEY": api_key,
        "Type": "json",
        "pIndex": "1",
        "pSize": "1000",
        "AGE": "22"
    }

    all_data = []

    print("📡 첫 페이지 호출 중...")
    response = requests.get(api_url, params=params)

    if response.status_code == 200:
        try:
            data = response.json()

            api_key_name = "nwbpacrgavhjryiph"
            if api_key_name in data and isinstance(data[api_key_name], list):
                api_list = data[api_key_name]

                if len(api_list) > 1 and 'row' in api_list[1]:
                    list_total_count = api_list[0]['head'][0]['list_total_count']
                    total_pages = math.ceil(list_total_count / 1000)
                    print(f"전체 데이터: {list_total_count}건, 총 {total_pages}페이지 처리 예정")

                    for page in range(1, total_pages + 1):
                        print(f"📄 {page}/{total_pages} 페이지 호출 중...")
                        params["pIndex"] = str(page)
                        response = requests.get(api_url, params=params)
                        data = response.json()
                        rows = data[api_key_name][1].get('row', [])
                        all_data.extend(rows)

                    # 필요한 필드만 추출 및 저장 (`LINK_URL`, `RGS_PROC_DT` 추가)
                    target_fields = ["BILL_ID", "BILL_NO", "BILL_NM", "PROPOSER", "PROC_RESULT_CD", "ANNOUNCE_DT", "LINK_URL", "RGS_PROC_DT"]

                    for row in all_data:
                        bill_data = {field: row.get(field, "") for field in target_fields}


                        # 저장 또는 업데이트
                        Law.objects.update_or_create(
                            BILL_ID=bill_data["BILL_ID"],
                            defaults={
                                "BILL_NO": bill_data["BILL_NO"],
                                "BILL_NM": bill_data["BILL_NM"],
                                "PROPOSER": bill_data["PROPOSER"],
                                "PROC_RESULT_CD": bill_data["PROC_RESULT_CD"],
                                "ANNOUNCE_DT": bill_data["ANNOUNCE_DT"],
                                "DETAIL_LINK": bill_data["LINK_URL"],  # 의안 링크 저장
                                "RGS_PROC_DT": bill_data["RGS_PROC_DT"]  # 의결일자 저장
                            }
                        )

                    print(f"\n✅ 총 {len(all_data)}건이 Law 테이블에 저장되었습니다.")
                else:
                    print("❌ 'row' 키가 없거나 데이터 형식이 잘못되었습니다.")
            else:
                print("❌ 유효한 응답 구조가 아닙니다.")
        except Exception as e:
            print(f"⚠️ 데이터 처리 오류: {e}")
    else:
        print(f"❌ API 요청 실패: {response.status_code}")