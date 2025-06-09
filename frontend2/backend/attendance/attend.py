import openpyxl
import os
from django.conf import settings
from attendance.models import Attendance

def import_attendance(file_name):
    file_path = os.path.join(settings.BASE_DIR, "attendance", "attendancefile", file_name)

    if not os.path.exists(file_path):
        print(f"❌ 파일을 찾을 수 없습니다: {file_path}")
        return

    wb = openpyxl.load_workbook(file_path)
    sheet = wb.active

    headers = [cell.value for cell in sheet[2]]
    print(f"📌 데이터 헤더: {headers}")

    # ✅ 5행부터 데이터를 읽음
    for row in sheet.iter_rows(min_row=5, values_only=True):
        print(f"🔍 A열: {row[0]} | B열(정당): {row[1]}")  # ✅ A, B열 출력

        member_name, party = row[0], row[1]

        if not member_name or member_name.strip() == "":
            print("⚠️ 빈 `member_name` 값이 감지됨. 데이터 저장을 건너뜁니다.")
            continue

        try:
            total_meetings = int(row[15])
            attendance = int(row[16])
            absences = int(row[17])
            leaves = int(row[18])
            business_trips = int(row[19])
        except (TypeError, ValueError):
            total_meetings = attendance = absences = leaves = business_trips = 0

        total_present = attendance + leaves + business_trips
        attendance_rate = (total_present / total_meetings) * 100 if total_meetings > 0 else 0
        absence_rate = (absences / total_meetings) * 100 if total_meetings > 0 else 0

        Attendance.objects.update_or_create(
            member_name=member_name.strip(),
            defaults={
                "party": party.strip(),
                "total_meetings": total_meetings,
                "attendance": attendance,
                "absences": absences,
                "leaves": leaves,
                "business_trips": business_trips,
                "attendance_rate": attendance_rate,
                "absence_rate": absence_rate,
            }
        )

    print(f"✅ {file_name} 파일의 출석 데이터가 DB에 저장되었습니다.")