from django.urls import path
from . import views

urlpatterns = [
    path('search_members', views.search_members, name='search_members'),
]