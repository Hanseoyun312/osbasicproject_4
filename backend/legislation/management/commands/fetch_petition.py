from django.core.management.base import BaseCommand
from legislation.api_petition import fetch_and_store_petitions

class Command(BaseCommand):
    help = "Fetch and store petitions from Open Assembly API"

    def handle(self, *args, **kwargs):
        fetch_and_store_petitions()
        self.stdout.write(self.style.SUCCESS("✅ 청원 데이터 저장 완료!"))