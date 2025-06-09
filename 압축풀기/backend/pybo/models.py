from django.db import models

# Create your models here.

class Question(models.Model):
    #제목처럼 글자 수가 제한된 텍스트는 CharField 사용
    subject=models.CharField(max_length=200) #제목은 최대 200자
    content=models.TextField()
    create_date=models.DateTimeField() #DateTimeField 날짜와 시간정보를 저장하는 속성

    def __str__(self):
        return self.subject

class Answer(models.Model):
    #Answer모델은 질몬에 대한 답변을 나타내서 Question모델을 속성으로 포함해야 함
    #기존 모델을 속성으로 연결하기 위해 ForeignKey사용. 
    question=models.ForeignKey(Question,on_delete=models.CASCADE) 
    #ForeignKey은 두 모델 간의 관계 정의때 사용,on_delete=models.CASCADE는 Answer이 연결된 Question이 삭제되면 해당 답변도 함께 삭제 된다는 의미
    #TextField은 글자 수에 제한이 없는 텍스트
    content=models.TextField()
    create_date=models.DateTimeField()