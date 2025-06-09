from collections import defaultdict
from vote.models import Lawmaker, Vote, LawmakerVoteSummary, BillVoteByParty, BillId
from legislation.models import ALL, Cost, Costly, Etc, Law

# 가결 및 부결 유형 정의
GAEOL_LIST = ["원안가결", "수정가결", "대안반영가결", "임시가결"]
BUGYEOL_LIST = ["부결", "폐기", "대안반영폐기"]

def get_bill_result_map():
    """
    BILL_ID별로 가결/부결 여부를 매핑
    """
    result_map = {}
    for model in [ALL, Cost, Costly, Etc, Law]:
        for item in model.objects.all():
            result_map[item.BILL_ID] = item.PROC_RESULT_CD
    return result_map

def update_vote_summary():
    """
    국회의원별 투표 요약 + 정당별 법안 투표 요약 계산 및 저장
    """
    bill_result_map = get_bill_result_map()

    print("✅ 국회의원 투표 요약 계산 시작...")

    # 1. 국회의원별 투표 요약
    for lawmaker in Lawmaker.objects.all():
        votes = Vote.objects.filter(lawmaker=lawmaker)

        total = votes.count()
        agree = votes.filter(vote_result='agree').count()
        oppose = votes.filter(vote_result='oppose').count()
        invalid = votes.filter(vote_result__in=['abstain', 'absent']).count()

        agree_and_passed = 0
        oppose_and_failed = 0
        agree_and_failed = 0
        oppose_and_passed = 0

        for v in votes:
            bill_result = bill_result_map.get(v.bill.bill_id)
            if bill_result in GAEOL_LIST:
                if v.vote_result == 'agree':
                    agree_and_passed += 1
                elif v.vote_result == 'oppose':
                    oppose_and_passed += 1
            elif bill_result in BUGYEOL_LIST:
                if v.vote_result == 'oppose':
                    oppose_and_failed += 1
                elif v.vote_result == 'agree':
                    agree_and_failed += 1

        LawmakerVoteSummary.objects.update_or_create(
            lawmaker=lawmaker,
            defaults={
                'total_votes': total,
                'agree_count': agree,
                'oppose_count': oppose,
                'invalid_or_abstain_count': invalid,
                'agree_and_passed': agree_and_passed,
                'oppose_and_failed': oppose_and_failed,
                'agree_and_failed': agree_and_failed,
                'oppose_and_passed': oppose_and_passed,
            }
        )

    print("✅ 법안별 정당 투표 요약 계산 시작...")

    # 2. 법안별 정당 요약 (BillId 기준)
    for bill_id_str in Vote.objects.values_list("bill__bill_id", flat=True).distinct():
        try:
            bill_obj = BillId.objects.get(bill_id=bill_id_str)
        except BillId.DoesNotExist:
            continue

        bill_votes = Vote.objects.filter(bill__bill_id=bill_id_str).select_related("lawmaker")
        party_map = defaultdict(lambda: {'agree': 0, 'oppose': 0, 'abstain': 0, 'absent': 0})

        for vote in bill_votes:
            lawmaker = vote.lawmaker
            if not lawmaker or not Lawmaker.objects.filter(id=lawmaker.id).exists():
                continue  # 현재 국회의원이 아닌 경우 무시

            # member를 통해 party 접근 (member가 없을 수도 있으니 안전하게 처리)
            party = getattr(lawmaker.member, 'party', None)
            if not party:
                continue

            if vote.vote_result == "agree":
                party_map[party]["agree"] += 1
            elif vote.vote_result == "oppose":
                party_map[party]["oppose"] += 1
            elif vote.vote_result == "abstain":
                party_map[party]["abstain"] += 1
            elif vote.vote_result == "absent":
                party_map[party]["absent"] += 1

        for party, counts in party_map.items():
            BillVoteByParty.objects.update_or_create(
                bill=bill_obj,
                party=party,
                defaults={
                    "agree": counts["agree"],
                    "oppose": counts["oppose"],
                    "abstain": counts["abstain"],
                    "absent": counts["absent"],
                }
            )

    print("✅ 모든 요약 계산 완료")
