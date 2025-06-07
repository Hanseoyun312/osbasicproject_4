from django.core.management.base import BaseCommand
from legislation.api_petition_introducer import fetch_and_store_introducer

class Command(BaseCommand):
    help = "Fetch and store introducer names for petitions"

    def handle(self, *args, **kwargs):
        fetch_and_store_introducer()
        self.stdout.write(self.style.SUCCESS("✅ 청원 소개 의원 정보 저장 완료!"))