# legislation/petition_introducer.py
import requests
from legislation.models import Petition, PetitionIntroducer  # 새로운 모델 import

api_key = "927928bf24af47d4afa7b805ed0bf4fc"
api_url = "https://open.assembly.go.kr/portal/openapi/PTTINFOPPSR"

def fetch_and_store_introducer():
    petitions = Petition.objects.all()  # DB에서 청원 목록 가져오기

    for petition in petitions:
        bill_id = petition.BILL_ID

        params = {
            "KEY": api_key,
            "Type": "json",
            "PTT_ID": bill_id
        }

        response = requests.get(api_url, params=params)

        if response.status_code == 200:
            try:
                data = response.json()
                proposer_name = "정보 없음"

                if "PTTINFOPPSR" in data and isinstance(data["PTTINFOPPSR"], list):
                    if len(data["PTTINFOPPSR"]) > 1 and "row" in data["PTTINFOPPSR"][1]:
                        row = data["PTTINFOPPSR"][1]["row"]
                        proposer_name = row[0].get("INTD_ASBLM_NM", "조회 실패") if row else "소개의원 없음"

            except Exception:
                proposer_name = "JSON 변환 실패"

        else:
            proposer_name = f"API 요청 실패: {response.status_code}"

        # 소개 의원 정보 DB 저장 (업데이트 or 추가)
        PetitionIntroducer.objects.update_or_create(
            petition=petition,
            defaults={"introducer_name": proposer_name}
        )

    print(f"✅ 총 {PetitionIntroducer.objects.count()}개의 청원 소개 의원 정보가 저장되었습니다.")