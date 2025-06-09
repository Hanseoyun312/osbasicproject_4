from django.core.management.base import BaseCommand
from vote.models import Lawmaker
from legislation.models import Member

class Command(BaseCommand):
    help = "이름 기준으로 Lawmaker와 Member 연결 (member 필드에 저장)"

    def handle(self, *args, **kwargs):
        unmatched = []   # 매칭 실패한 Lawmaker 이름 리스트
        count_linked = 0  # 연결된 개수

        for lawmaker in Lawmaker.objects.all():
            try:
                # 이름 정제: 공백 제거, 소문자 변환 (필요하면 적용)
                lawmaker_name_clean = lawmaker.name.strip()

                # Member 조회 (이름 정확히 일치해야 함)
                member = Member.objects.get(name=lawmaker_name_clean)

                # 연결
                lawmaker.member = member
                lawmaker.save()
                count_linked += 1
                self.stdout.write(self.style.SUCCESS(f"[OK] {lawmaker.name} → {member.party}"))

            except Member.DoesNotExist:
                unmatched.append(lawmaker.name)
                self.stdout.write(self.style.WARNING(f"[MISS] {lawmaker.name}"))

        self.stdout.write(self.style.SUCCESS(f"\n총 연결 완료: {count_linked}명"))
        if unmatched:
            self.stdout.write(self.style.ERROR(f"연결 실패: {len(unmatched)}명"))
            self.stdout.write(", ".join(unmatched))
