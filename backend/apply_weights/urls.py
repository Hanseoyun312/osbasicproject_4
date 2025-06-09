from django.urls import path
from .views import update_weights

urlpatterns = [
    path('update_weights/', update_weights),
]
