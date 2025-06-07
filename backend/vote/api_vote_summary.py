from vote.models import Lawmaker, Vote, LawmakerVoteSummary
from legislation.models import ALL, Cost, Costly, Etc, Law

# 가결 및 부결 유형 정의
GAEOL_LIST = ["원안가결", "수정가결", "대안반영가결", "임시가결"]
BUGYEOL_LIST = ["부결", "폐기", "대안반영폐기"]

def get_bill_result_map():
    """
    법안 ID별로 가결/부결 여부를 매핑
    """
    result_map = {}
    for model in [ALL, Cost, Costly, Etc, Law]:
        for item in model.objects.all():
            result_map[item.BILL_ID] = item.PROC_RESULT_CD  # 법안 처리 결과 ('가결', '부결' 등)
    return result_map

def update_vote_summary():
    """
    국회의원별 투표 요약 데이터를 업데이트
    """
    bill_result_map = get_bill_result_map()

    for lawmaker in Lawmaker.objects.all():
        votes = Vote.objects.filter(lawmaker=lawmaker)

        # 기본 투표 데이터 계산
        total = votes.count()
        agree = votes.filter(vote_result='agree').count()
        oppose = votes.filter(vote_result='oppose').count()
        invalid = votes.filter(vote_result__in=['abstain', 'absent']).count()

        # 가결 및 부결에 따른 세부 데이터 계산
        agree_and_passed = 0
        oppose_and_failed = 0
        agree_and_failed = 0  # 🔥 추가: 찬성했지만 부결
        oppose_and_passed = 0  # 🔥 추가: 반대했지만 가결

        for v in votes:
            bill_result = bill_result_map.get(v.bill.bill_id)

            if bill_result in GAEOL_LIST:  # ✅ 모든 가결 유형 포함
                if v.vote_result == 'agree':
                    agree_and_passed += 1
                elif v.vote_result == 'oppose':  # 🔥 반대했는데 가결
                    oppose_and_passed += 1
            elif bill_result in BUGYEOL_LIST:  # ✅ 모든 부결 유형 포함
                if v.vote_result == 'oppose':
                    oppose_and_failed += 1
                elif v.vote_result == 'agree':  # 🔥 찬성했는데 부결
                    agree_and_failed += 1

        # 데이터 저장
        LawmakerVoteSummary.objects.update_or_create(
            lawmaker=lawmaker,
            defaults={
                'total_votes': total,
                'agree_count': agree,
                'oppose_count': oppose,
                'invalid_or_abstain_count': invalid,
                'agree_and_passed': agree_and_passed,
                'oppose_and_failed': oppose_and_failed,
                'agree_and_failed': agree_and_failed,  # 🔥 추가
                'oppose_and_passed': oppose_and_passed,  # 🔥 추가
            }
        )
