from django.urls import path
from .views import chatbot_api, chatbot_page

urlpatterns = [
    path("ask/", chatbot_api),
    path("chatbot/", chatbot_page),
]
