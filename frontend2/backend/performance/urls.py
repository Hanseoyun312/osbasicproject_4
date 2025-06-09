from django.urls import path
from performance.views import (
    get_performance_data, 
    get_party_weighted_performance, 
    get_party_performance_stats, 
    update_weights_and_recalculate,  # ✅ 새로운 API 추가
    get_lawmaker_performance_by_party,
)

urlpatterns = [
    path("api/performance/", get_performance_data, name="get_performance_data"),
    path("api/party_performance/", get_party_weighted_performance, name="get_party_weighted_performance"),
    path("api/party_stats/", get_party_performance_stats, name="get_party_performance_stats"),
    path("api/update_weights/", update_weights_and_recalculate, name="update_weights_and_recalculate"),  # ✅ 사용자 입력 반영 API
    path("api/performance/by-party/", get_lawmaker_performance_by_party, name="get_lawmaker_performance_by_party"),
]