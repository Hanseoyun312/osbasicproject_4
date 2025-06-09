import time
from django.core.management.base import BaseCommand
from vote.api_vote import fetch_vote_data_for_bill, get_all_bill_ids  # ✅ 필요한 함수 import 추가

class Command(BaseCommand):
    help = "모든 BILL_ID에 대해 국회의원 투표 결과 데이터를 API로부터 수집하여 저장합니다."

    def handle(self, *args, **kwargs):
        bill_ids = get_all_bill_ids()
        print(f"✅ 국회의원 투표 데이터 수집을 시작합니다... 총 {len(bill_ids)}개의 BILL_ID 처리")

        for idx, bill_id in enumerate(bill_ids, start=1):
            print(f"[{idx}/{len(bill_ids)}] BILL_ID: {bill_id}")
            fetch_vote_data_for_bill(bill_id)  # ✅ `bill_id`를 인자로 전달
            time.sleep(1)  # ✅ API 과다 요청 방지

        print("\n🎉 모든 투표 데이터 저장 완료!")