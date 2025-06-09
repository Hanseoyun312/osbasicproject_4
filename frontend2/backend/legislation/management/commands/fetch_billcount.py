from django.core.management.base import BaseCommand
from legislation.api_bill_count import fetch_and_save_billcount

class Command(BaseCommand):
    help = "Bill 데이터를 기반으로 의원별 법안 통계를 집계 및 저장"

    def handle(self, *args, **kwargs):
        fetch_and_save_billcount()