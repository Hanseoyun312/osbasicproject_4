from django.core.management.base import BaseCommand
from legislation.api_mainsource import fetch_and_save_mainsource  # 실제 앱 이름에 맞게 수정

class Command(BaseCommand):
    help = "국회의원 기본 정보를 API에서 수집해 DB에 저장합니다."

    def handle(self, *args, **options):
        fetch_and_save_mainsource()
