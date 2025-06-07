from django.urls import path

from . import views

app_name='pybo'

urlpatterns=[
    path('',views.index,name='index'), #pybo/가 생략된 ''사용
    path('<int:question_id>/',views.detail,name='detail'),
    path('answer/create/<int:question_id>/',views.answer_create,name='answer_create'),
]
