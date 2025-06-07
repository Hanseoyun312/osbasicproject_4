# legislation/committee_fetch.py

import requests
import math
from legislation.models import CommitteeMember

def fetch_and_save_committee():
    api_url = "https://open.assembly.go.kr/portal/openapi/nktulghcadyhmiqxi"
    api_key = "927928bf24af47d4afa7b805ed0bf4fc"

    p_size = 1000
    params = {
        "KEY": api_key,
        "Type": "json",
        "pIndex": 1,
        "pSize": p_size
    }

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

        # 기존 데이터 삭제
        CommitteeMember.objects.all().delete()

        # 저장
        for row in all_rows:
            CommitteeMember.objects.create(
                DEPT_NM=row.get("DEPT_NM", ""),
                JOB_RES_NM=row.get("JOB_RES_NM", ""),
                HG_NM=row.get("HG_NM", ""),
                POLY_NM=row.get("POLY_NM", ""),
                MONA_CD=row.get("MONA_CD", "")
            )

        print(f"\n✅ 총 {len(all_rows)}명의 위원회 위원이 DB에 저장되었습니다.")

    except Exception as e:
        print("❌ 오류 발생:", str(e))
