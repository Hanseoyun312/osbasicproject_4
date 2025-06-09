from django.core.management.base import BaseCommand
from attendance.attend import import_attendance

class Command(BaseCommand):
    help = "엑셀 파일에서 출석 데이터를 가져와 DB에 저장합니다."

    def add_arguments(self, parser):
        parser.add_argument("file_name", type=str, help="엑셀 파일 이름")

    def handle(self, *args, **options):
        file_name = options["file_name"]
        import_attendance(file_name)
        self.stdout.write(self.style.SUCCESS("✅ 출석 데이터가 DB에 저장되었습니다."))