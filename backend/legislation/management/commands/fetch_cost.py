# legislation/management/commands/fetch_cost.py

from django.core.management.base import BaseCommand
from legislation.api_cost import fetch_and_save_cost

class Command(BaseCommand):
    help = "비용추계 법안 목록을 API로부터 받아와 DB에 저장합니다."

    def handle(self, *args, **kwargs):
        fetch_and_save_cost()
