from django.core.management.base import BaseCommand
from vote.models import Vote, BillId, BillVoteSummary, Lawmaker

class Command(BaseCommand):
    help = '안건별 투표 요약 및 투표율 업데이트'

    def handle(self, *args, **options):
        total_lawmaker_count = Lawmaker.objects.count()  # 전체 국회의원 수

        for bill_obj in BillId.objects.all():
            votes = Vote.objects.filter(bill=bill_obj)

            total_votes = votes.exclude(vote_result='absent').count()  # 불참 제외 투표 참여 인원 수
            agree_count = votes.filter(vote_result='agree').count()
            oppose_count = votes.filter(vote_result='oppose').count()
            abstain_count = votes.filter(vote_result='abstain').count()
            absent_count = votes.filter(vote_result='absent').count()

            # 참여율: 소수 → 백분율로 변환
            participation_rate = (total_votes / total_lawmaker_count) * 100 if total_lawmaker_count else 0
            participation_rate = round(participation_rate, 1)  # 소수점 1자리 반올림

            BillVoteSummary.objects.update_or_create(
                bill=bill_obj,
                defaults={
                    'total_votes': total_votes,
                    'participation_rate': participation_rate,
                    'agree_count': agree_count,
                    'oppose_count': oppose_count,
                    'abstain_count': abstain_count,
                    'absent_count': absent_count,
                }
            )

        self.stdout.write(self.style.SUCCESS('✅ 안건별 투표 요약 및 투표율 업데이트 완료'))
