from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json
from performance.models import Performance, PartyPerformance
from legislation.models import Member
from performance.serializers import PerformanceSerializer, PartyPerformanceSerializer
from performance.api_result import calculate_performance_scores  # ✅ 국회의원 실적 업데이트
from performance.party_stats import calculate_party_performance_scores  # ✅ 정당 실적 업데이트

@api_view(["GET"])
def get_performance_data(request):
    """총 실적 점수를 사용자의 입력에 따라 정렬하여 반환 (현재 국회의원만 필터링)"""
    order = request.GET.get("order", "desc")  # 기본값: 내림차순(desc)
    limit = int(request.GET.get("limit", 10))  # 기본값: 10개 출력

    if order not in ("asc", "desc"):
        return Response({"error": "⚠️ 정렬 방식은 'asc' 또는 'desc' 중 하나여야 합니다."}, status=400)

    order_by = "total_score" if order == "asc" else "-total_score"

    # 현재 국회의원 목록 가져오기
    current_lawmaker_names = Member.objects.values_list("name", flat=True)

    # 현재 국회의원만 포함하여 정렬
    performances = Performance.objects.filter(lawmaker__name__in=current_lawmaker_names).order_by(order_by)[:limit]

    if not performances.exists():
        return Response({"message": "❌ 실적 데이터가 없습니다."}, status=404)

    serializer = PerformanceSerializer(performances, many=True)
    return Response({"ranking": serializer.data})

@api_view(["GET"])
def get_party_weighted_performance(request):
    """가중치를 반영한 정당별 실적 점수를 DB에서 조회하여 반환"""
    order = request.GET.get("order", "desc")  # 기본: 내림차순

    if order not in ("asc", "desc"):
        return Response({"error": "⚠️ 정렬 방식은 'asc' 또는 'desc' 중 하나여야 합니다."}, status=400)

    stats = PartyPerformance.objects.all().order_by(
        "weighted_score" if order == "asc" else "-weighted_score"
    )

    if not stats.exists():
        return Response({"message": "❌ 정당 통계 데이터가 없습니다."}, status=404)

    serializer = PartyPerformanceSerializer(stats, many=True)
    return Response({"party_ranking": serializer.data})

@api_view(["GET"])
def get_party_performance_stats(request):
    """정당별 통계 전체 목록 조회"""
    stats = PartyPerformance.objects.all().order_by("-weighted_score")
    serializer = PartyPerformanceSerializer(stats, many=True)
    return Response({"party_stats": serializer.data})

@csrf_exempt
@api_view(["POST"])
def update_weights_and_recalculate(request):
    """사용자 입력을 반영하여 국회의원 및 정당 실적 업데이트"""
    if request.method == "POST":
        data = json.loads(request.body)

        # 사용자 입력이 없으면 기본 가중치 사용
        weights = data if data else {
            "attendance_weight": 8.0,
            "bill_passed_weight": 40.0,
            "petition_proposed_weight": 8.0,
            "petition_result_weight": 23.0,
            "committee_weight": 5.0,
            "adjusted_invalid_vote_weight": 2.0,
            "vote_match_weight": 7.0,
            "vote_mismatch_weight": 4.0
        }

        calculate_performance_scores(weights)  # 국회의원 실적 업데이트
        calculate_party_performance_scores(weights)  # 정당 실적 업데이트

        return JsonResponse({"message": "✅ 실적 업데이트 완료! (사용자 입력 반영됨)"})
    

@api_view(["GET"])
def get_lawmaker_performance_by_party(request):
    """
    정당별 국회의원 실적 순위 반환 API
    - /api/performance/by-party?party=정당명&order=desc&limit=10
    - 결과에 rank(등수)도 포함됨
    """
    party = request.GET.get("party")
    order = request.GET.get("order", "desc")
    limit = int(request.GET.get("limit", 10))

    if not party:
        return Response({"error": "⚠️ 'party' 파라미터가 필요합니다."}, status=400)

    if order not in ("asc", "desc"):
        return Response({"error": "⚠️ 정렬 방식은 'asc' 또는 'desc' 중 하나여야 합니다."}, status=400)

    order_by = "total_score" if order == "asc" else "-total_score"

    # 해당 정당 소속 의원 중 현재 의원만 필터링
    current_lawmaker_names = Member.objects.filter(party=party).values_list("name", flat=True)

    performances = Performance.objects.filter(
        lawmaker__name__in=current_lawmaker_names
    ).order_by(order_by)[:limit]

    if not performances.exists():
        return Response({"message": f"❌ '{party}' 소속 국회의원의 실적 데이터가 없습니다."}, status=404)

    serializer = PerformanceSerializer(performances, many=True)
    serialized_data = serializer.data

    # 등수(rank) 필드 추가
    for idx, item in enumerate(serialized_data, start=1):
        item["rank"] = idx

    return Response({
        "party": party,
        "ranking": serialized_data
    })
