# legislation/management/commands/fetch_bill_details.py
from django.core.management.base import BaseCommand
from legislation.api_bill import fetch_and_save_bill

class Command(BaseCommand):
    help = "법률안 상세 목록 데이터를 API에서 가져와 DB에 저장"

    def handle(self, *args, **kwargs):
        fetch_and_save_bill()
        self.stdout.write(self.style.SUCCESS("✅ 법률안 데이터 저장 완료!"))