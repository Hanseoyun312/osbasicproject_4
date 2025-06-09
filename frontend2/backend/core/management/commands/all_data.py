from django.core.management.base import BaseCommand
import subprocess

class Command(BaseCommand):
    help = 'Run all data fetching and import commands in sequence'

    def handle(self, *args, **options):
        commands = [
            ['python', 'manage.py', 'fetch_all'],
            ['python', 'manage.py', 'fetch_bill'],
            ['python', 'manage.py', 'fetch_billcount'],
            ['python', 'manage.py', 'fetch_commitee'],
            ['python', 'manage.py', 'fetch_cosstly'],
            ['python', 'manage.py', 'fetch_cost'],
            ['python', 'manage.py', 'fetch_etc'],
            ['python', 'manage.py', 'fetch_law'],
            ['python', 'manage.py', 'fetch_mainsource'],
            ['python', 'manage.py', 'fetch_petition'],
            ['python', 'manage.py', 'fetch_petition_introducer'],
            ['python', 'manage.py', 'fetch_photo'],
            ['python', 'manage.py', 'import_attendance', '제424회국회(임시회) 본회의 출결현황.xlsx'],
            ['python', 'manage.py', 'fetch_vote'],
            ['python', 'manage.py', 'fetch_vote_summary'],
            ['python', 'manage.py', 'fetch_result'],
        ]

        for cmd in commands:
            self.stdout.write(self.style.NOTICE(f"Running: {' '.join(cmd)}"))
            subprocess.run(cmd, check=True)
