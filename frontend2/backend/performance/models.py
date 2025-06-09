from django.db import models
from vote.models import Lawmaker

class Performance(models.Model):
    lawmaker = models.OneToOneField(Lawmaker, on_delete=models.CASCADE) #Lawmaker의 id
    party = models.CharField(max_length=100) #정당
    total_score = models.FloatField() #총 실적
    attendance_score = models.FloatField() #출석
    bill_pass_score = models.FloatField() #가결된 법률안
    petition_score = models.IntegerField() #청원제시
    petition_result_score = models.IntegerField() #청원 가결
    committee_score = models.IntegerField() #위원회
    invalid_vote_ratio = models.FloatField() #기권및 무효
    vote_match_ratio = models.FloatField() #투표와 결과가 맞는경우
    vote_mismatch_ratio = models.FloatField() #투표와 결과가 다른경우
    committee_leader_count = models.IntegerField(default=0)  # 위원장 수
    committee_secretary_count = models.IntegerField(default=0)  # 간사 수

    # 새로 추가된 필드
    committee_leader_score = models.FloatField(default=0.0)  # 위원장 점수 (leader_count * 5)
    committee_secretary_score = models.FloatField(default=0.0)  # 간사 점수 (secretary_count * 3)
    
    def __str__(self):
        return f"{self.lawmaker.name} - 실적"
    
class PartyPerformance(models.Model):
    party = models.CharField(max_length=100, unique=True)

    # 출석률 관련 필드
    avg_attendance = models.FloatField(default=0.0) #평균
    max_attendance = models.FloatField(default=0.0) #최대
    min_attendance = models.FloatField(default=0.0) #최소
    std_attendance = models.FloatField(default=0.0) #표준편차

    # 기권 및 무효표 관련 필드
    avg_invalid_vote_ratio = models.FloatField(default=0.0)
    max_invalid_vote_ratio = models.FloatField(default=0.0)
    min_invalid_vote_ratio = models.FloatField(default=0.0)
    std_invalid_vote_ratio = models.FloatField(default=0.0)

    # 표결 일치율 관련 필드
    avg_vote_match_ratio = models.FloatField(default=0.0)
    max_vote_match_ratio = models.FloatField(default=0.0)
    min_vote_match_ratio = models.FloatField(default=0.0)
    std_vote_match_ratio = models.FloatField(default=0.0)

    # 표결 불일치율 관련 필드
    avg_vote_mismatch_ratio = models.FloatField(default=0.0)
    max_vote_mismatch_ratio = models.FloatField(default=0.0)
    min_vote_mismatch_ratio = models.FloatField(default=0.0)
    std_vote_mismatch_ratio = models.FloatField(default=0.0)

    # 법안 가결 수, 청원 관련 필드
    bill_pass_sum = models.IntegerField(default=0)
    petition_sum = models.IntegerField(default=0)
    petition_pass_sum = models.IntegerField(default=0)

    # 위원회 활동 필드
    committee_leader_count = models.IntegerField(default=0) #위원장 수
    committee_secretary_count = models.IntegerField(default=0) #간사 수

    # 정당별 총 의원 수
    member_count = models.IntegerField(default=0)

    # 최종 실적 점수 (가중 평균)
    weighted_score = models.FloatField(default=0.0) #가중치 반영 실적
    avg_total_score = models.FloatField(default=0.0)  # ✅ 국회의원 실적 평균

    # 기여도 퍼센트
    attendance_pct = models.FloatField(default=0.0)
    bill_pass_pct = models.FloatField(default=0.0)
    petition_pct = models.FloatField(default=0.0)
    petition_result_pct = models.FloatField(default=0.0)
    vote_match_pct = models.FloatField(default=0.0)
    vote_mismatch_pct = models.FloatField(default=0.0)
    invalid_vote_pct = models.FloatField(default=0.0)
    
    def __str__(self):
        return f"{self.party} - 정당 실적"