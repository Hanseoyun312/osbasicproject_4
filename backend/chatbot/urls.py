from django.urls import path
from .views import chatbot_ask, chatbot_page

urlpatterns = [
    path("ask/", chatbot_ask),
    path("chatbot/", chatbot_page),
]
