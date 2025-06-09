from django.core.management.base import BaseCommand
from performance.party_stats import calculate_party_performance_scores

class Command(BaseCommand):
    help = "정당별 실적 통계를 계산하여 저장"

    def handle(self, *args, **kwargs):
        calculate_party_performance_scores()
        self.stdout.write(self.style.SUCCESS("✅ 정당별 실적 통계가 성공적으로 저장되었습니다."))
