# legislation/api_all.py

import requests
import math
from .models import ALL

api_key = "927928bf24af47d4afa7b805ed0bf4fc"
api_url = "https://open.assembly.go.kr/portal/openapi/nxjuyqnxadtotdrbw"
p_size = 1000
age = "22"

def fetch_and_save_all():
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

    total_count = data[api_url.split("/")[-1]][0]['head'][0]['list_total_count']
    total_pages = math.ceil(total_count / p_size)
    print(f"총 {total_count}건, {total_pages} 페이지 처리 예정")

    for page in range(1, total_pages + 1):
        print(f"📄 {page}/{total_pages} 페이지 수집 중...")
        params["pIndex"] = str(page)
        resp = requests.get(api_url, params=params)
        data = resp.json()
        rows = data[api_url.split("/")[-1]][1].get("row", [])

        for row in rows:
            ALL.objects.update_or_create(
                BILL_ID=row.get("BILL_ID", ""),
                defaults={
                    "AGE": row.get("AGE", ""),
                    "BILL_NM": row.get("BILL_NAME", ""),           # 안건명 저장 추가
                    "PROC_RESULT_CD": row.get("PROC_RESULT_CD", ""),
                    "PROPOSER": row.get("PROPOSER", ""),
                    "DETAIL_LINK": row.get("LINK_URL", ""),
                    "RGS_PROC_DT": row.get("PROC_DT", "")
                }
            )

    print(f"✅ 총 {total_count}건이 DB에 저장/업데이트 되었습니다.")
