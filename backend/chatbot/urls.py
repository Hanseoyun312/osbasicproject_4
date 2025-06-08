from django.urls import path
from .views import chatbot_view, chatbot_page

urlpatterns = [
    path("ask/", chatbot_view),
    path("chatbot/", chatbot_page),
]
