import json
import re
from collections import defaultdict
from legislation.models import Bill, Bill_count

def fetch_and_save_billcount():
    stats = defaultdict(lambda: {
        "total": 0,
        "approved": 0,
        "discarded": 0,
        "rejected": 0,
        "other": 0
    })

    bills = Bill.objects.all()
    print(f"🚀 {bills.count()}개의 법률안 데이터를 처리 중...")

    for bill in bills:
        main_proposer = bill.MAIN_PROPOSER.strip()

        try:
            co_proposers_raw = json.loads(bill.CO_PROPOSERS)
            if not isinstance(co_proposers_raw, list):
                co_proposers_raw = []
        except json.JSONDecodeError:
            print(f"⚠️ CO_PROPOSERS JSON 변환 오류 - BILL_ID {bill.BILL_ID}")
            co_proposers_raw = []

        clean_proposers = []
        for entry in co_proposers_raw:
            split_names = re.split(r"[,\s/와과및&]+", entry)
            for name in split_names:
                name = name.strip()
                if 2 <= len(name) <= 4:
                    clean_proposers.append(name)

        result = bill.PROC_RESULT.strip() if bill.PROC_RESULT else "UNKNOWN"

        if main_proposer and 2 <= len(main_proposer) <= 4:
            stats[main_proposer]["total"] += 1
            if result in ("가결", "수정가결"):
                stats[main_proposer]["approved"] += 1
            elif result in ("폐기", "대안반영폐기", "임기만료폐기"):
                stats[main_proposer]["discarded"] += 1
            elif result == "부결":
                stats[main_proposer]["rejected"] += 1
            else:
                stats[main_proposer]["other"] += 1

        for proposer in clean_proposers:
            stats[proposer]["total"] += 1
            if result in ("가결", "수정가결"):
                stats[proposer]["approved"] += 1
            elif result in ("폐기", "대안반영폐기", "임기만료폐기"):
                stats[proposer]["discarded"] += 1
            elif result == "부결":
                stats[proposer]["rejected"] += 1
            else:
                stats[proposer]["other"] += 1

    Bill_count.objects.all().delete()

    for proposer, counts in stats.items():
        try:
            bill_count = Bill_count(
                proposer=proposer,
                total=counts["total"],
                approved=counts["approved"],
                discarded=counts["discarded"],
                rejected=counts["rejected"],
                other=counts["other"]
            )
            bill_count.save()

            # 저장된 데이터 즉시 확인
            saved_count = Bill_count.objects.filter(proposer=proposer).first()
            if saved_count:
                print(f"✅ 저장 확인됨 - '{saved_count.proposer}' 총 {saved_count.total}건")
            else:
                print(f"❌ 저장된 데이터 조회 실패 - '{proposer}'")

        except Exception as e:
            print(f"❌ 저장 중 오류 발생: {e}")

    print("🎉 국회의원별 발의 통계 저장 완료!")