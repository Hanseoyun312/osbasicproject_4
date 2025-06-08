from django.urls import path
from .views import chatbot_api

urlpatterns = [
    path("ask/", chatbot_api)
]
