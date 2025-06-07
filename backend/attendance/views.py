from django.shortcuts import render

# Create your views here.
from rest_framework.response import Response
from rest_framework.decorators import api_view
from attendance.models import Attendance  # ✅ 모델 import
from attendance.serializers import AttendanceSerializer  # ✅ Serializer import

@api_view(["GET"])
def get_attendance_data(request):
    """Attendance 모델 데이터 반환"""
    data = Attendance.objects.all()
    serializer = AttendanceSerializer(data, many=True)
    return Response(serializer.data)