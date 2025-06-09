from rest_framework import serializers
from performance.models import Performance, PartyPerformance

class PerformanceSerializer(serializers.ModelSerializer):
    lawmaker_name = serializers.CharField(source='lawmaker.name', read_only=True)

    class Meta:
        model = Performance
        fields = "__all__"  # 기존 필드 전부 + lawmaker_name 포함
        # 또는 fields = ['id', 'lawmaker', 'lawmaker_name', 'total_score', ...] 처럼 명시해도 됨

class PartyPerformanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartyPerformance
        fields = "__all__"  # 정당 통계에는 이름 필드 추가 안함
