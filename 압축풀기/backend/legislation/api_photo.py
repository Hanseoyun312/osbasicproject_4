import requests
from legislation.models import Member, Photo

api_key = "927928bf24af47d4afa7b805ed0bf4fc"
api_url = "https://open.assembly.go.kr/portal/openapi/ALLNAMEMBER"

def fetch_and_store_members():
    Photo.objects.all().delete()
    print("🗑️ 기존 Photo 데이터 전부 삭제 완료")
    
    current_mona_codes = set(code.upper().strip() for code in Member.objects.values_list("mona_cd", flat=True))
    print(f"✅ 현재 DB에 저장된 22대 국회의원 수: {len(current_mona_codes)}")

    total_saved = 0
    pIndex = 1
    pSize = 100

    while True:
        params = {
            "KEY": api_key,
            "Type": "json",
            "pIndex": str(pIndex),
            "pSize": str(pSize)
        }

        response = requests.get(api_url, params=params)
        if response.status_code != 200:
            print(f"❌ 요청 실패: status code {response.status_code}")
            break

        data = response.json()
        if len(data) != 1:
            print("❌ 응답 데이터 구조가 예상과 다릅니다.")
            break

        root_key = next(iter(data))
        items = data.get(root_key, [])

        if len(items) <= 1 or "row" not in items[1]:
            print("✅ 더 이상 데이터가 없습니다. 종료합니다.")
            break

        rows = items[1]["row"]
        if not rows:
            print("✅ 빈 페이지 도달, 종료합니다.")
            break

        count_this_page = 0

        for row in rows:
            election_term = row.get("GTELT_ERACO", "")
            if election_term is None:
                election_term = ""

            member_code = row.get("NAAS_CD", "")
            if member_code is None:
                member_code = ""
            member_code = member_code.upper().strip()

            member_name = row.get("NAAS_NM", "") or ""

            photo_url = row.get("NAAS_PIC", "") or ""

            if "제22대" in election_term and member_code in current_mona_codes:
                Photo.objects.update_or_create(
                    member_code=member_code,
                    defaults={
                        "member_name": member_name,
                        "photo": photo_url
                    }
                )
                count_this_page += 1
                total_saved += 1
                print(f"✅ 저장됨: {member_name} ({member_code})")
            else:
                print(f"⏭️ 제외됨: {member_name} ({member_code}) - 선거대수: {election_term}")

        print(f"📄 페이지 {pIndex} 저장 완료: {count_this_page}명")

        if len(rows) < pSize:
            print("✅ 마지막 페이지 도달, 종료합니다.")
            break

        pIndex += 1

    print(f"🎉 최종 저장된 22대 국회의원 사진 수: {total_saved}")
