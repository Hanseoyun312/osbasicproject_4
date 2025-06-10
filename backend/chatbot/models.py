from django.db import models

# Create your models here.
from django.db import models

# ✅ 1. ranking_members.db → ranking_members 테이블
class RankingMember(models.Model):
    HG_NM = models.TextField()  # 국회의원 이름
    POLY_NM = models.TextField()  # 소속 정당
    총점 = models.FloatField()
    출석 = models.FloatField()
    법안가결 = models.FloatField()
    청원제시 = models.FloatField()
    청원결과 = models.FloatField()
    위원회 = models.FloatField()
    기권_무효 = models.FloatField()
    표결일치 = models.FloatField()
    표결불일치 = models.FloatField()
    총점_순위 = models.IntegerField()
    출석_순위 = models.IntegerField()
    법안가결_순위 = models.IntegerField()
    청원제시_순위 = models.IntegerField()
    청원결과_순위 = models.IntegerField()
    위원회_순위 = models.IntegerField()
    기권_무효_순위 = models.IntegerField()
    표결일치_순위 = models.IntegerField()
    표결불일치_순위 = models.IntegerField()

    class Meta:
        db_table = "ranking_members"
        managed = False  # 외부 DB 테이블, Django가 관리하지 않음

# ✅ 2. ranking_parties.db → party_score
class PartyScore(models.Model):
    POLY_NM = models.TextField()
    평균실적 = models.FloatField()
    의원수 = models.IntegerField()
    가중점수 = models.FloatField()
    평균실적_순위 = models.IntegerField()
    의원수_순위 = models.IntegerField()
    가중점수_순위 = models.IntegerField()

    class Meta:
        db_table = "party_score"
        managed = False

# ✅ 3. ranking_parties.db → party_statistics_kr
class PartyStatistics(models.Model):
    정당 = models.TextField()
    출석_평균 = models.FloatField()
    출석_최고 = models.FloatField()
    출석_최저 = models.FloatField()
    출석_표준편차 = models.FloatField()
    기권무효_평균 = models.FloatField()
    기권무효_최고 = models.FloatField()
    기권무효_최저 = models.FloatField()
    기권무효_표준편차 = models.FloatField()
    표결일치_평균 = models.FloatField()
    표결일치_최고 = models.FloatField()
    표결일치_최저 = models.FloatField()
    표결일치_표준편차 = models.FloatField()
    표결불일치_평균 = models.FloatField()
    표결불일치_최고 = models.FloatField()
    표결불일치_최저 = models.FloatField()
    표결불일치_표준편차 = models.FloatField()
    법안가결_총합 = models.IntegerField()
    청원제시_총합 = models.IntegerField()
    청원결과_총합 = models.IntegerField()
    위원회_총합 = models.FloatField()

    class Meta:
        db_table = "party_statistics_kr"
        managed = False
