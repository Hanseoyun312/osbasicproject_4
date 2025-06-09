from django.urls import path
from attendance.views import get_attendance_data  # ✅ View import

urlpatterns = [
    path("attendance/", get_attendance_data, name="get_attendance_data"),  # ✅ API 경로 추가
]