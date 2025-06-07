from django.urls import path
from vote.views import get_lawmaker_data, get_bill_data, get_vote_data, get_lawmaker_vote_summary_data

urlpatterns = [
    path("lawmaker/", get_lawmaker_data, name="get_lawmaker_data"),
    path("bill/", get_bill_data, name="get_bill_data"),
    path("vote/", get_vote_data, name="get_vote_data"),
    path("vote-summary/", get_lawmaker_vote_summary_data, name="get_lawmaker_vote_summary_data"),
]