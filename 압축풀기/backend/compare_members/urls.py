from django.urls import path
from . import views

urlpatterns = [
    path('', views.compare_members, name='compare_members'),
]
