from rest_framework import serializers
from attendance.models import Attendance  # ✅ 모델 import

class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance  # ✅ Attendance 모델을 직렬화
        fields = "__all__"  # ✅ 모든 필드를 포함