import requests
import time
from django.core.management.base import BaseCommand
from legislation.models import ALL, Bill as LegislationBill, Costly, Cost, Etc, Law, Petition
from vote.models import Lawmaker, BillId, Vote

API_KEY = '927928bf24af47d4afa7b805ed0bf4fc'
VOTE_API_URL = "https://open.assembly.go.kr/portal/openapi/nojepdqqaweusdfbi"


def get_all_bill_ids():
    bill_ids = set()
    for model in [ALL, LegislationBill, Costly, Cost, Etc, Law, Petition]:
        ids = model.objects.values_list('BILL_ID', flat=True)
        bill_ids.update(ids)
    return bill_ids


def fetch_vote_data_for_bill(bill_id):
    params = {
        "KEY": API_KEY,
        "Type": "json",
        "pIndex": "1",
        "pSize": "1000",
        "AGE": "22",  # 제22대 국회
        "BILL_ID": bill_id
    }

    try:
        response = requests.get(VOTE_API_URL, params=params)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"[{bill_id}] API 호출 오류: {e}")
        return

    api_key_name = VOTE_API_URL.split("/")[-1]
    if api_key_name not in data:
        print(f"[{bill_id}] ❌ 키 '{api_key_name}' 없음 (잘못된 응답 구조)")
        return

    content = data.get(api_key_name)
    if not content or len(content) < 2:
        print(f"[{bill_id}] ❌ 데이터 구조 이상")
        return

    rows = content[1].get("row", [])
    if not rows:
        print(f"[{bill_id}] ⚠️ 투표 데이터 없음")
        return

    bill, _ = BillId.objects.get_or_create(bill_id=bill_id)

    vote_map = {
        '찬성': 'agree',
        '반대': 'oppose',
        '기권': 'abstain',
        '불참': 'absent',
    }

    for row in rows:
        name = row.get("HG_NM")
        raw_vote = row.get("RESULT_VOTE_MOD", "").strip()

        if not name or raw_vote not in vote_map:
            continue

        result = vote_map[raw_vote]
        lawmaker, _ = Lawmaker.objects.get_or_create(name=name)

        Vote.objects.update_or_create(
            lawmaker=lawmaker,
            bill=bill,
            defaults={'vote_result': result}
        )

    print(f"[{bill_id}] ✅ 투표 데이터 {len(rows)}건 저장 완료")


class Command(BaseCommand):
    help = "모든 BILL_ID에 대해 국회의원 투표 결과 데이터를 API로부터 수집하여 저장합니다."

    def handle(self, *args, **kwargs):
        bill_ids = get_all_bill_ids()
        print(f"총 {len(bill_ids)}개의 BILL_ID 처리 시작")

        for idx, bill_id in enumerate(bill_ids, start=1):
            print(f"[{idx}/{len(bill_ids)}] BILL_ID: {bill_id}")
            fetch_vote_data_for_bill(bill_id)
            time.sleep(1)  # API 과다 요청 방지

        print("\n🎉 모든 투표 데이터 저장 완료!")
