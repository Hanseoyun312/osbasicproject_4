from rest_framework import serializers
from vote.models import Lawmaker, BillId, Vote, LawmakerVoteSummary

class LawmakerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lawmaker
        fields = "__all__"

class BillIdSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillId
        fields = "__all__"

class VoteSerializer(serializers.ModelSerializer):
    lawmaker = LawmakerSerializer()
    bill = BillIdSerializer()

    class Meta:
        model = Vote
        fields = "__all__"

class LawmakerVoteSummarySerializer(serializers.ModelSerializer):
    lawmaker = LawmakerSerializer()

    class Meta:
        model = LawmakerVoteSummary
        fields = "__all__"