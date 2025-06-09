# legislation/management/commands/fetch_committee.py

from django.core.management.base import BaseCommand
from legislation.api_committee import fetch_and_save_committee

class Command(BaseCommand):
    help = "위원회 위원 명단을 API로부터 받아와 DB에 저장합니다."

    def handle(self, *args, **kwargs):
        fetch_and_save_committee()
