# legislation/management/commands/fetch_bills.py

from django.core.management.base import BaseCommand
from legislation.api_all import fetch_and_save_all

class Command(BaseCommand):
    help = "열린국회정보 ALL API 데이터 수집 및 DB 저장"

    def handle(self, *args, **kwargs):
        fetch_and_save_all()
