from django.core.management.base import BaseCommand
from performance.api_result import calculate_performance_scores

class Command(BaseCommand):
    help = "사용자 입력을 기반으로 국회의원 실적을 계산하여 DB에 저장합니다."

    def add_arguments(self, parser):
        # 사용자가 입력할 수 있는 옵션 (기본값 설정)
        parser.add_argument("--attendance", type=float, default=-10.0, help="출석률 가중치")
        parser.add_argument("--bill_passed", type=float, default=50.0, help="법안 가결 가중치")
        parser.add_argument("--petition_proposed", type=float, default=15.5, help="청원 제시 가중치")
        parser.add_argument("--petition_result", type=float, default=30.5, help="청원 결과 가중치")
        parser.add_argument("--committee", type=float, default=5.0, help="위원회 경력 가중치")
        parser.add_argument("--invalid_or_abstain", type=float, default=-2.5, help="기권/무효표 가중치")
        parser.add_argument("--vote_match", type=float, default=7.5, help="표결 일치 가중치")
        parser.add_argument("--vote_mismatch", type=float, default=4.0, help="표결 불일치 가중치")

    def handle(self, *args, **options):
        print("🔍 국회의원 실적 계산 시작...")

        calculate_performance_scores(
            attendance_weight=options["attendance"],
            bill_passed_weight=options["bill_passed"],
            petition_proposed_weight=options["petition_proposed"],
            petition_result_weight=options["petition_result"],
            committee_weight=options["committee"],
            invalid_or_abstain_weight=options["invalid_or_abstain"],
            vote_match_weight=options["vote_match"],
            vote_mismatch_weight=options["vote_mismatch"],
        )

        print("🎯 국회의원 실적 계산 완료! 기본값 또는 사용자 설정값이 반영되었습니다.")