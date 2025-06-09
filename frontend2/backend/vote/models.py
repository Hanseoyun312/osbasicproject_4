from django.db import models
from legislation.models import Member

class Lawmaker(models.Model):
    name = models.CharField(max_length=100, unique=True)  #의원이름
    member = models.OneToOneField(Member, null=True, blank=True, on_delete=models.SET_NULL)
    def __str__(self):
        return self.name

class BillId(models.Model):
    bill_id = models.CharField(max_length=100, unique=True)  #표결결과 있는 의안ID

    def __str__(self):
        return self.bill_id

class Vote(models.Model):
    VOTE_CHOICES = [
        ('agree', '찬성'),
        ('oppose', '반대'),
        ('abstain', '기권'),
        ('absent', '불참'),
    ]

    lawmaker = models.ForeignKey(Lawmaker, on_delete=models.CASCADE) #Lawmaker의 id
    bill = models.ForeignKey(BillId, on_delete=models.CASCADE) #BillId의 id
    #'찬성': 'agree',  '반대': 'oppose', '기권': 'abstain',  '불참': 'absent',
    vote_result = models.CharField(max_length=10, choices=VOTE_CHOICES) #투표 결과

    class Meta:
        unique_together = ('lawmaker', 'bill')

class LawmakerVoteSummary(models.Model):
    lawmaker = models.OneToOneField('Lawmaker', on_delete=models.CASCADE)

    total_votes = models.PositiveIntegerField(default=0) #총 투표수
    agree_count = models.PositiveIntegerField(default=0) #찬성 수
    oppose_count = models.PositiveIntegerField(default=0) #반대 수
    invalid_or_abstain_count = models.PositiveIntegerField(default=0) #기권 및 무효표 수

    agree_and_passed = models.PositiveIntegerField(default=0)  # 찬성 가결
    oppose_and_failed = models.PositiveIntegerField(default=0)  # 반대 부결
    agree_and_failed = models.PositiveIntegerField(default=0)  # 🔥 찬성 부결 추가
    oppose_and_passed = models.PositiveIntegerField(default=0)  # 🔥 반대 가결 추가

    def __str__(self):
        return f"{self.lawmaker.name} - 요약"



class BillVoteByParty(models.Model):
    bill = models.ForeignKey('vote.BillId', on_delete=models.CASCADE)
    party = models.CharField(max_length=50)

    agree = models.PositiveIntegerField(default=0)
    oppose = models.PositiveIntegerField(default=0)
    abstain = models.PositiveIntegerField(default=0)
    absent = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('bill', 'party')


class BillVoteSummary(models.Model):
    bill = models.OneToOneField(BillId, on_delete=models.CASCADE)

    total_votes = models.PositiveIntegerField(default=0)  # 투표 참여 인원 수
    participation_rate = models.FloatField(default=0.0)  # 투표율 (0~100)

    agree_count = models.PositiveIntegerField(default=0) #찬성
    oppose_count = models.PositiveIntegerField(default=0) #반대
    abstain_count = models.PositiveIntegerField(default=0) #기권
    absent_count = models.PositiveIntegerField(default=0) #불참

    def __str__(self):
        return f"{self.bill.bill_id} - 투표 요약"
