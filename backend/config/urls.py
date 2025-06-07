"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from ranking_members.views import get_member_rankings
from ranking_parties.views import get_party_score, get_party_stats

urlpatterns = [
    path('admin/', admin.site.urls),
    path('compare_members/', include('compare_members.urls')),
    path('compare_parties/', include('compare_parties.urls')),
    path('searchapi/', include('searchapi.urls')),
    path("chatbot/", include("chatbot.urls")),
    path('ranking/members/', get_member_rankings),
    path('ranking/parties/score/', get_party_score),
    path('ranking/parties/stats/', get_party_stats),
    path('pybo/',include('pybo.urls')),
    path("performance/", include("performance.urls")),  # 🔥 performance 앱 추가!
    path("legislation/", include("legislation.urls")),  # 🚀 legislation 앱의 API 
    path("vote/", include("vote.urls")),  # 🚀 vote 앱의 API 연결!
    path("attendance/", include("attendance.urls")),  # 🚀 attendance 앱 API 연결!
]