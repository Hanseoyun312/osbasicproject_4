from django.core.management.base import BaseCommand
from vote.api_vote_summary import update_vote_summary

class Command(BaseCommand):
    help = "국회의원별 투표 요약 데이터를 집계하여 저장합니다."

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("✅ 국회의원 투표 요약 계산 시작..."))
        update_vote_summary()
        self.stdout.write(self.style.SUCCESS("🎉 완료: LawmakerVoteSummary 테이블에 저장되었습니다."))
