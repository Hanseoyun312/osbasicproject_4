from django.db import models

# Create your models here.

class Attendance(models.Model):
    member_name = models.CharField(max_length=100)  # 의원 이름
    party = models.CharField(max_length=100)  # 소속 정당
    total_meetings = models.IntegerField()  # 총 회의 수
    attendance = models.IntegerField()  # 출석 수
    absences = models.IntegerField()  # 결석 수
    leaves = models.IntegerField()  # 청가 수
    business_trips = models.IntegerField()  # 출장 수
    attendance_rate = models.FloatField()  # 출석률 (%)
    absence_rate = models.FloatField()  # 결석률 (%)

    def __str__(self):
        return f"{self.member_name} ({self.party}) - 출석률: {self.attendance_rate:.2f}%"