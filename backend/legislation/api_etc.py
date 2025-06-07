import requests
import math
from legislation.models import Etc

def fetch_and_save_etc():
    api_key = "927928bf24af47d4afa7b805ed0bf4fc"
    api_url = "https://open.assembly.go.kr/portal/openapi/nbslryaradshbpbpm"
    p_size = 1000

    params = {
        "KEY": api_key,
        "Type": "json",
        "pIndex": "1",
        "pSize": str(p_size),
        "AGE": "22"
    }

    all_data = []

    print("📡 첫 페이지 호출 중...")
    response = requests.get(api_url, params=params)

    if response.status_code != 200:
        print(f"❌ API 요청 실패: {response.status_code}")
        return

    try:
        data = response.json()
        api_name = api_url.split('/')[-1]

        if api_name not in data:
            print("❌ 예기치 않은 응답 구조입니다.")
            return

        list_total_count = data[api_name][0]["head"][0]["list_total_count"]
        total_pages = math.ceil(list_total_count / p_size)
        print(f"총 {list_total_count}건, {total_pages}페이지 처리 예정")

        for page in range(1, total_pages + 1):
            print(f"📄 {page}/{total_pages} 페이지 호출 중...")
            params["pIndex"] = str(page)
            response = requests.get(api_url, params=params)
            data = response.json()

            rows = data[api_name][1].get("row", [])
            all_data.extend(rows)

        # 최신 논의된 법안이 리스트의 첫 부분에 위치하도록 정렬
        all_data = sorted(all_data, key=lambda x: x.get("RGS_PROC_DT", ""), reverse=True)

        # 기존 데이터 삭제 (선택)
        Etc.objects.all().delete()

        for row in all_data:
            try:
                BILL_ID = row.get("BILL_ID", "")
                PROC_RESULT_CD = row.get("PROC_RESULT_CD", "")
                LINK_URL = row.get("LINK_URL", "")
                RGS_PROC_DT = row.get("RGS_PROC_DT", "")
                BILL_NM = row.get("BILL_NM", "")  # 안건명 추가
                PROPOSER=row.get("PROPOSER", "")
                if not BILL_ID:
                    continue  # BILL_ID 없으면 skip

                existing_record = Etc.objects.filter(BILL_ID=BILL_ID).order_by("-RGS_PROC_DT").first()

                # 날짜 비교 함수 (빈 값 처리 포함)
                def is_newer(date_new, date_old):
                    if not date_old:
                        return True
                    if not date_new:
                        return False
                    return date_new > date_old

                if not existing_record or is_newer(RGS_PROC_DT, existing_record.RGS_PROC_DT):
                    Etc.objects.update_or_create(
                        BILL_ID=BILL_ID,
                        defaults={
                            "age": row.get("AGE", ""),
                            "PROC_RESULT_CD": PROC_RESULT_CD,
                            "DETAIL_LINK": LINK_URL,
                            "RGS_PROC_DT": RGS_PROC_DT,
                            "BILL_NM": BILL_NM,
                            "PROPOSER":PROPOSER,
                        }
                    )

            except Exception as e:
                print(f"❌ 저장 중 오류 발생: {e}")

        print(f"\n✅ 총 {len(all_data)}개의 법안 정보가 DB에 저장되었습니다.")

    except Exception as e:
        print("❌ 데이터 처리 중 오류 발생:", str(e))
