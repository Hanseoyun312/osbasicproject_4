from django.shortcuts import render
from rest_framework.response import Response
from rest_framework.decorators import api_view
from legislation.models import (
    ALL, Bill, Bill_count, CommitteeMember, Costly, Cost, Etc, Law,
    Member, Petition, PetitionIntroducer, Photo
)
from legislation.serializers import (
    ALLSerializer, BillSerializer, BillCountSerializer, CommitteeMemberSerializer,
    CostlySerializer, CostSerializer, EtcSerializer, LawSerializer,
    MemberSerializer, PetitionSerializer, PetitionIntroducerSerializer, PhotoSerializer
)


@api_view(["GET"])
def get_all_data(request):
    """ALL 모델 데이터 반환"""
    data = ALL.objects.all()
    serializer = ALLSerializer(data, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_bill_data(request):
    """Bill 모델 데이터 반환"""
    data = Bill.objects.all()
    serializer = BillSerializer(data, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_committee_member_data(request):
    """CommitteeMember 모델 데이터 반환"""
    data = CommitteeMember.objects.all()
    serializer = CommitteeMemberSerializer(data, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_member_data(request):
    """Member 모델 데이터 반환"""
    data = Member.objects.all()
    serializer = MemberSerializer(data, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_petition_data(request):
    """Petition 모델 데이터 반환"""
    data = Petition.objects.all()
    serializer = PetitionSerializer(data, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_bill_count_data(request):
    """BillCount 모델 데이터 반환"""
    data = Bill_count.objects.all()
    serializer = BillCountSerializer(data, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_costly_data(request):
    """Costly 모델 데이터 반환"""
    data = Costly.objects.all()
    serializer = CostlySerializer(data, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_cost_data(request):
    """Cost 모델 데이터 반환"""
    data = Cost.objects.all()
    serializer = CostSerializer(data, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_etc_data(request):
    """Etc 모델 데이터 반환"""
    data = Etc.objects.all()
    serializer = EtcSerializer(data, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_law_data(request):
    """Law 모델 데이터 반환"""
    data = Law.objects.all()
    serializer = LawSerializer(data, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_petition_introducer_data(request):
    """PetitionIntroducer 모델 데이터 반환"""
    data = PetitionIntroducer.objects.all()
    serializer = PetitionIntroducerSerializer(data, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_photo_data(request):
    """Photo 모델 데이터 반환"""
    data = Photo.objects.all()
    serializer = PhotoSerializer(data, many=True)
    return Response(serializer.data)