from django.shortcuts import render

# Create your views here.
from rest_framework.response import Response
from rest_framework.decorators import api_view
from vote.models import Lawmaker, BillId, Vote, LawmakerVoteSummary,BillVoteByParty,BillVoteSummary
from vote.serializers import LawmakerSerializer, BillIdSerializer, VoteSerializer, LawmakerVoteSummarySerializer,BillVoteByPartySerializer,BillVoteSummarySerializer

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

@api_view(["GET"])
def get_bill_vote_by_party_data(request):
    """BillVoteByParty 모델 데이터 반환"""
    records = BillVoteByParty.objects.all()
    serializer = BillVoteByPartySerializer(records, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def get_bill_vote_summaries(request):
    summaries = BillVoteSummary.objects.all().order_by('-participation_rate')  # 참여율 높은 순
    serializer = BillVoteSummarySerializer(summaries, many=True)
    return Response(serializer.data)