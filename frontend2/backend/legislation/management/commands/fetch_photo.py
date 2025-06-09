# legislation/management/commands/fetch_photo.py
from django.core.management.base import BaseCommand
from legislation.api_photo import fetch_and_store_members

class Command(BaseCommand):
    help = "22대 국회의원 사진을 API에서 가져와 저장합니다."

    def handle(self, *args, **kwargs):
        fetch_and_store_members()
