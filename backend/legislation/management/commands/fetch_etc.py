# legislation/management/commands/fetch_etc.py

from django.core.management.base import BaseCommand
from legislation.api_etc import fetch_and_save_etc

class Command(BaseCommand):
    help = "기타 법안 목록을 API로부터 받아와 DB에 저장합니다."

    def handle(self, *args, **kwargs):
        fetch_and_save_etc()
