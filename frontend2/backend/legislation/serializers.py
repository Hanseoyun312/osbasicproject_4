from rest_framework import serializers
from legislation.models import (
    ALL, Bill, Bill_count, CommitteeMember, Costly, Cost, Etc, Law,
    Member, Petition, PetitionIntroducer, Photo
)

class ALLSerializer(serializers.ModelSerializer):
    class Meta:
        model = ALL
        fields = "__all__"

class BillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bill
        fields = "__all__"

class BillCountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bill_count
        fields = "__all__"

class CommitteeMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommitteeMember
        fields = "__all__"

class CostlySerializer(serializers.ModelSerializer):
    class Meta:
        model = Costly
        fields = "__all__"

class CostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cost
        fields = "__all__"

class EtcSerializer(serializers.ModelSerializer):
    class Meta:
        model = Etc
        fields = "__all__"

class LawSerializer(serializers.ModelSerializer):
    class Meta:
        model = Law
        fields = "__all__"

class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = "__all__"

class PetitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Petition
        fields = "__all__"

class PetitionIntroducerSerializer(serializers.ModelSerializer):
    class Meta:
        model = PetitionIntroducer
        fields = "__all__"

class PhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Photo
        fields = "__all__"