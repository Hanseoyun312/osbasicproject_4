from django.core.management.base import BaseCommand
from legislation.api_law import fetch_and_save_law  # 앱 이름에 맞게 수정

class Command(BaseCommand):
    help = "22대 법률안 데이터를 Open API에서 불러와 저장합니다."

    def handle(self, *args, **options):
        fetch_and_save_law()
