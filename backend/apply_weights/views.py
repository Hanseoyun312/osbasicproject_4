from django.shortcuts import render

# Create your views here.
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json

@csrf_exempt
def update_weights(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            weights = data.get("weights")

            # 👉 weights를 이용해서 점수 계산 & ranking_members.db 업데이트하는 코드 여기에 추가
            # 예: calculate_and_save_new_rankings(weights)

            return JsonResponse({"status": "success", "message": "Weights applied successfully."})
        except Exception as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=500)
    return JsonResponse({"error": "POST only"}, status=405)
