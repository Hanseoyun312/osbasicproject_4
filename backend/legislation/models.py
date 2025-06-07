from django.db import models

# Create your models here.

class ALL(models.Model):
    AGE = models.CharField(max_length=10) #대수수
    BILL_ID = models.CharField(max_length=50, unique=True) #국회의원 코드
    BILL_NM = models.CharField(max_length=200, blank=True)  # 안건명 추가
    PROC_RESULT_CD = models.CharField(max_length=20, blank=True)#의결결과
    PROPOSER = models.CharField(max_length=200, blank=True)#제안자
    DETAIL_LINK = models.URLField(blank=True)#링크
    RGS_PROC_DT = models.CharField(max_length=20, null=True, blank=True)  # 의결일

    def __str__(self):
        return f"{self.BILL_NM} ({self.BILL_ID})"
    

class Bill(models.Model):
    BILL_ID = models.CharField(max_length=50, unique=True)  # 법안 ID
    BILL_NM = models.CharField(max_length=200, blank=True)  # 안건명 추가
    MAIN_PROPOSER = models.CharField(max_length=100, default="UNKNOWN")  # 대표 발의자
    CO_PROPOSERS = models.TextField(default="[]")  # 공동 발의자 리스트를 JSON 문자열로 저장
    PROC_RESULT = models.CharField(max_length=100, default="UNKNOWN", null=True, blank=True) #의결결과
    
    def __str__(self):
        return f"{self.BILL_NM} ({self.BILL_ID})"
    


class Bill_count(models.Model):
    proposer = models.CharField(max_length=100) #제안자
    total = models.IntegerField(default=0) #총 수
    approved = models.IntegerField(default=0)   # 가결 수
    discarded = models.IntegerField(default=0)  # 폐기 수
    rejected = models.IntegerField(default=0)   # 부결 수
    other = models.IntegerField(default=0) #기타 수

    def __str__(self):
        return self.proposer
    

class CommitteeMember(models.Model):
    DEPT_NM = models.CharField(max_length=100, blank=True)      # 소속 위원회
    JOB_RES_NM = models.CharField(max_length=100, blank=True)   # 직책 (예: 위원장)
    HG_NM = models.CharField(max_length=100)                    # 이름
    POLY_NM = models.CharField(max_length=100, blank=True)      # 정당
    MONA_CD = models.CharField(max_length=20, blank=True)       # 고유 코드

    def __str__(self):
        return f"{self.HG_NM} - {self.DEPT_NM} ({self.JOB_RES_NM})"
    


class Costly(models.Model):
    age = models.CharField(max_length=10)  # 국회 대수
    BILL_ID = models.CharField(max_length=100, unique=True)  # 의안 ID
    BILL_NM = models.CharField(max_length=200, blank=True)  # 안건명 추가
    PROC_RESULT_CD = models.CharField(max_length=50, blank=True)  # 처리 결과 코드
    DETAIL_LINK = models.URLField(blank=True) #링크
    RGS_PROC_DT = models.CharField(max_length=20, null=True, blank=True)  # 의결일
    PROPOSER = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f"{self.BILL_NM} ({self.BILL_ID})"
    

class Cost(models.Model):
    age = models.CharField(max_length=10)  # 국회 대수
    BILL_ID = models.CharField(max_length=100, unique=True)  # 의안 ID
    BILL_NM = models.CharField(max_length=200, blank=True)  # 안건명 추가
    PROC_RESULT_CD = models.CharField(max_length=50, blank=True)  # 처리 결과 코드
    DETAIL_LINK = models.URLField(blank=True) #링크
    RGS_PROC_DT = models.CharField(max_length=20, null=True, blank=True)  # 의결일
    PROPOSER = models.CharField(max_length=200, blank=True) #제안자
    
    def __str__(self):
        return f"{self.BILL_NM} ({self.BILL_ID})"
    

class Etc(models.Model):
    age = models.CharField(max_length=10)  # 국회 대수
    BILL_ID = models.CharField(max_length=100, unique=True)  # 의안 ID
    BILL_NM = models.CharField(max_length=200, blank=True)  # 안건명 추가
    PROC_RESULT_CD = models.CharField(max_length=50, blank=True)  # 처리 결과 코드
    DETAIL_LINK = models.URLField(blank=True) #링크
    RGS_PROC_DT = models.CharField(max_length=20, null=True, blank=True)  # 의결일
    PROPOSER = models.CharField(max_length=200, blank=True) #제안자
    
    def __str__(self):
        return f"{self.BILL_NM} ({self.BILL_ID})"
    

class Law(models.Model):
    BILL_ID = models.CharField(max_length=100, unique=True) #의안 ID
    BILL_NO = models.CharField(max_length=50, blank=True) #
    BILL_NM = models.TextField(blank=True) #의안명
    PROPOSER = models.CharField(max_length=100, blank=True) #제안자
    PROC_RESULT_CD = models.CharField(max_length=50, blank=True) #의안 결과
    ANNOUNCE_DT = models.CharField(max_length=20, null=True, blank=True) #공포일
    DETAIL_LINK = models.URLField(blank=True) #링크
    RGS_PROC_DT = models.CharField(max_length=20, null=True, blank=True)  # 의결일

    def __str__(self):
        return f"{self.BILL_NM} ({self.BILL_NO})"
    


class Member(models.Model):
    name = models.CharField(max_length=100)          # 이름
    party = models.CharField(max_length=100)         # 정당
    mona_cd = models.CharField(max_length=20)        # 국회의원 코드
    committees = models.TextField(blank=True)        # 소속위원회목록
    phone = models.CharField(max_length=100, blank=True)   # 전화번호
    email = models.CharField(max_length=100, blank=True, null=True)   # E_MAIL
    homepage = models.URLField(blank=True,null=True)           # HOMEPAGE

    def __str__(self):
        return f"{self.name} ({self.party})"


class Petition(models.Model):
    BILL_ID = models.CharField(max_length=50, unique=True) #의안 ID
    BILL_NO = models.CharField(max_length=50, blank=True) #청원번호
    BILL_NAME = models.CharField(max_length=200) #청원명
    PROPOSER = models.CharField(max_length=200, blank=True) #제안자
    PROC_RESULT_CD = models.CharField(max_length=50, blank=True) #의결결과
    DETAIL_LINK = models.URLField(blank=True) #링크
    PROPOSE_DT = models.CharField(max_length=20, null=True, blank=True)  # 청원접수일자

    def __str__(self):
        return f"{self.BILL_NAME} ({self.BILL_ID})"

class PetitionIntroducer(models.Model):
    petition = models.OneToOneField(Petition, on_delete=models.CASCADE)  # 청원과 연결
    introducer_name = models.CharField(max_length=200, blank=True)  # 소개 의원명

    def __str__(self):
        return f"소개 의원: {self.introducer_name} ({self.petition.BILL_ID})"



class Photo(models.Model):
    member_code = models.CharField(max_length=50, unique=True)  # 의원 코드
    member_name = models.CharField(max_length=100)  # 의원 이름
    photo = models.CharField(max_length=255, blank=True, null=True)  # ✅ 사진 URL 저장

    def __str__(self):
        return f"{self.member_name} ({self.member_code})"
