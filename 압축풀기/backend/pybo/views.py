from django.shortcuts import render,get_object_or_404,redirect
from django.utils import timezone
# Create your views here.
from .models import Question

def index(request):
    #order_by : 조회결과 정렬(-:역방향,없으면:순방향)
    question_list=Question.objects.order_by('-create_date')
    context={'question_list':question_list}
    #render : 질문 목록으로 조회한 question_list데이터를 question_list.html파일에 적용하여 html생성 후 리턴
    return render(request,'pybo/question_list.html',context)

def detail(request,question_id):
    question=get_object_or_404(Question,pk=question_id) #pk:Question모델의 기본키를 의미미 
    context ={'question':question}
    return render(request,'pybo/question_detail.html',context)

def answer_create(request,question_id):
    question=get_object_or_404(Question,pk=question_id)
    question.answer_set.create(content=request.POST.get('content'),create_date=timezone.now())
    return redirect('pybo:detail',question_id=question.id)
