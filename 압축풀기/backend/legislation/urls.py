from django.urls import path
from legislation.views import (
    get_all_data, get_bill_data, get_committee_member_data,
    get_member_data, get_petition_data, get_bill_count_data, 
    get_costly_data, get_cost_data, get_etc_data, get_law_data,
    get_petition_introducer_data, get_photo_data
)

urlpatterns = [
    path("all/", get_all_data, name="get_all_data"),
    path("bill/", get_bill_data, name="get_bill_data"),
    path("committee-member/", get_committee_member_data, name="get_committee_member_data"),
    path("member/", get_member_data, name="get_member_data"),
    path("petition/", get_petition_data, name="get_petition_data"),
    
    # ✅ 추가된 모델 API
    path("bill-count/", get_bill_count_data, name="get_bill_count_data"),
    path("costly/", get_costly_data, name="get_costly_data"),
    path("cost/", get_cost_data, name="get_cost_data"),
    path("etc/", get_etc_data, name="get_etc_data"),
    path("law/", get_law_data, name="get_law_data"),
    path("petition-introducer/", get_petition_introducer_data, name="get_petition_introducer_data"),
    path("photo/", get_photo_data, name="get_photo_data"),
]