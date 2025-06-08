import json
from collections import defaultdict

# 저장된 파일 불러오기
with open("bill.json", "r", encoding="utf-8") as f:
    data = json.load(f)

bills = data.get("bills", [])

# 의원별 통계 저장용
stats = defaultdict(lambda: {
    "total": 0,
    "가결": 0,
    "폐기": 0,
    "부결": 0,
    "기타": 0
})

for bill in bills:
    main_proposer = bill.get("MAIN_PROPOSER", "").strip()
    co_proposers = bill.get("CO_PROPOSERS", [])
    result = (bill.get("PROC_RESULT") or "").strip()

    # 공동 제안자 리스트가 아닌 경우 처리
    if not isinstance(co_proposers, list):
        co_proposers = []

    all_proposers = [main_proposer] + co_proposers

    for proposer in all_proposers:
        proposer = proposer.strip()
        if not proposer:
            continue

        stats[proposer]["total"] += 1

        if result in ("가결", "수정가결"):
            stats[proposer]["가결"] += 1
        elif result in ("폐기", "대안반영폐기", "임기만료폐기"):
            stats[proposer]["폐기"] += 1
        elif result == "부결":
            stats[proposer]["부결"] += 1
        else:
            stats[proposer]["기타"] += 1

# 결과 저장
with open("bill_count.json", "w", encoding="utf-8") as f:
    json.dump(stats, f, ensure_ascii=False, indent=2)

print("✅ 국회의원별 안건 통계가 'bill_stats_by_member.json'에 저장되었습니다.")
