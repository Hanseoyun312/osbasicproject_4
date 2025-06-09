from rest_framework import serializers
from vote.models import Lawmaker, BillId, Vote, LawmakerVoteSummary,BillVoteByParty,BillVoteSummary

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

class BillVoteByPartySerializer(serializers.ModelSerializer):
    class Meta:
        model = BillVoteByParty
        fields = '__all__'  # 모든 필드를 노출, 필요시 리스트로 조절 가능


class BillVoteSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = BillVoteSummary
        fields = '__all__'