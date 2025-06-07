from django.shortcuts import render

# Create your views here.
from rest_framework.response import Response
from rest_framework.decorators import api_view
from vote.models import Lawmaker, BillId, Vote, LawmakerVoteSummary
from vote.serializers import LawmakerSerializer, BillIdSerializer, VoteSerializer, LawmakerVoteSummarySerializer

@api_view(["GET"])
def get_lawmaker_data(request):
    """Lawmaker 모델 데이터 반환"""
    lawmakers = Lawmaker.objects.all()
    serializer = LawmakerSerializer(lawmakers, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_bill_data(request):
    """BillId 모델 데이터 반환"""
    bills = BillId.objects.all()
    serializer = BillIdSerializer(bills, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_vote_data(request):
    """Vote 모델 데이터 반환"""
    votes = Vote.objects.all()
    serializer = VoteSerializer(votes, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_lawmaker_vote_summary_data(request):
    """LawmakerVoteSummary 모델 데이터 반환"""
    summaries = LawmakerVoteSummary.objects.all()
    serializer = LawmakerVoteSummarySerializer(summaries, many=True)
    return Response(serializer.data)