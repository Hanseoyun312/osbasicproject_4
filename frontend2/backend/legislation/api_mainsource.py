import requests
from .models import Member
import json

def fetch_and_save_mainsource():
    api_url = "https://open.assembly.go.kr/portal/openapi/nwvrqwxyaytdsfvhu"
    api_key = "927928bf24af47d4afa7b805ed0bf4fc"

    params = {
        "KEY": api_key,
        "Type": "json",
        "pIndex": "1",
        "pSize": "300"
    }

    response = requests.get(api_url, params=params)

    if response.status_code != 200:
        print(f"API 요청 실패: {response.status_code}")
        return

    try:
        data = response.json()
        api_data = data.get("nwvrqwxyaytdsfvhu", [])

        if len(api_data) < 2:
            print("API 데이터 구조가 예상과 다릅니다.")
            return

        rows = api_data[1].get("row", [])
        if not isinstance(rows, list):
            print("'row' 키가 없거나 리스트 형식이 아닙니다.")
            return

        print(f"👨‍💼 총 {len(rows)}명의 국회의원 데이터를 가져왔습니다.")

        api_mona_cd_set = set()  # API에서 받은 MONA_CD 저장용

        for row in rows:
            mona_cd_value = row.get("MONA_CD", "") or ""

            if not mona_cd_value.strip():
                print(f"❌ `MONA_CD` 값이 비어 있습니다. 해당 데이터는 저장되지 않습니다.")
                continue

            api_mona_cd_set.add(mona_cd_value)

            homepage_value = row.get("HOMEPAGE", "") or ""
            homepage_value = homepage_value.strip() if homepage_value else None

            email_value = row.get("E_MAIL", "") or ""
            email_value = email_value.strip() if email_value else None

            Member.objects.update_or_create(
                mona_cd=mona_cd_value,
                defaults={
                    "name": row.get("HG_NM", "") or "",
                    "party": row.get("POLY_NM", "") or "",
                    "committees": row.get("CMITS", "") or "",
                    "phone": row.get("TEL_NO", "") or "",
                    "email": email_value,
                    "homepage": homepage_value
                }
            )

        # API에 없는 DB 데이터 삭제
        deleted_count, _ = Member.objects.exclude(mona_cd__in=api_mona_cd_set).delete()
        print(f"🗑️ API에 없는 {deleted_count}건의 DB 데이터를 삭제했습니다.")

        print("🎉 국회의원 정보 저장 및 불필요 데이터 삭제 완료!")

    except json.JSONDecodeError:
        print("❌ JSON 파싱 실패")
        print(response.text[:1000])  # 오류 확인을 위한 출력
