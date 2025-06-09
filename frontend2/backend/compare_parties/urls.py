from django.urls import path
from . import views

urlpatterns = [
    path('', views.compare_parties, name='compare_parties'),
]
