import requests
import json
import time
from legislation.models import Bill  # Django 모델 import

API_URL = "https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn"
API_KEY = "927928bf24af47d4afa7b805ed0bf4fc"
AGE = "22"
PAGESIZE = 1000

def fetch_and_save_bill():
    print("📡 첫 페이지 호출 중...")
    params = {
        "KEY": API_KEY,
        "Type": "json",
        "pIndex": 1,
        "pSize": PAGESIZE,
        "AGE": AGE,
    }

    try:
        resp = requests.get(API_URL, params=params)
        data = resp.json()
        total_count = data["nzmimeepazxkubdpn"][0]["head"][0]["list_total_count"]
        total_pages = (total_count // PAGESIZE) + 1
        print(f"총 {total_count}건의 데이터, {total_pages}페이지 처리 예정")
    except Exception as e:
        print("❌ 첫 페이지 불러오기 실패:", str(e))
        return

    for page in range(1, total_pages + 1):
        print(f"📄 {page}/{total_pages} 페이지 처리 중...")
        params["pIndex"] = page

        try:
            resp = requests.get(API_URL, params=params)
            try:
                data = resp.json()
            except Exception:
                print(f"⚠️ JSON 파싱 실패 (페이지 {page}), 응답 내용:\n{resp.text[:200]}")
                continue  # 다음 페이지로 넘어감

            rows = data.get("nzmimeepazxkubdpn", [])[1].get("row", [])
        except Exception as e:
            print(f"❌ 페이지 {page} 처리 실패:", str(e))
            continue

        for row in rows:
            bill_id = str(row.get("BILL_ID", ""))  # 문자열 변환 후 저장
            if not bill_id:
                continue  # 필수 정보 누락 시 스킵

            co_proposers_raw = row.get("PUBL_PROPOSER", "")
            co_proposers = []
            if isinstance(co_proposers_raw, str):
                co_proposers = [name.strip() for name in co_proposers_raw.split(",") if name.strip()]

            proc_result = row.get("PROC_RESULT", "UNKNOWN")
            if not proc_result:  # ✅ NULL 값 방지
                proc_result = "UNKNOWN"

            bill_nm = row.get("BILL_NAME", "")  # 안건명 추가

            try:
                bill, created = Bill.objects.update_or_create(
                    BILL_ID=bill_id,
                    defaults={
                        "MAIN_PROPOSER": row.get("RST_PROPOSER", "UNKNOWN"),
                        "CO_PROPOSERS": json.dumps(co_proposers, ensure_ascii=False),  # ✅ UTF-8 인코딩 유지
                        "PROC_RESULT": proc_result,  # ✅ NULL 문제 해결
                        "BILL_NM": bill_nm,  # 안건명 저장
                    },
                )
            except Exception as e:
                print(f"❌ BILL_ID {bill_id} 저장 실패: {str(e)}")

        time.sleep(0.5)  # 과도한 요청 방지

    print("✅ 모든 데이터를 성공적으로 저장했습니다.")
