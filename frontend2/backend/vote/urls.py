from django.urls import path
from vote.views import get_lawmaker_data, get_bill_data, get_vote_data, get_lawmaker_vote_summary_data, get_bill_vote_by_party_data,get_bill_vote_summaries

urlpatterns = [
    path("lawmaker/", get_lawmaker_data, name="get_lawmaker_data"),
    path("bill/", get_bill_data, name="get_bill_data"),
    path("vote/", get_vote_data, name="get_vote_data"),
    path("vote-summary/", get_lawmaker_vote_summary_data, name="get_lawmaker_vote_summary_data"),
    path("vote-by-party/", get_bill_vote_by_party_data, name="get_bill_vote_by_party_data"),  # 추가
    path("bill-vote-summary/", get_bill_vote_summaries, name="get_bill_vote_summaries"),
]