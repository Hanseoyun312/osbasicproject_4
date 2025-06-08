import os
import json
import sqlite3
from dotenv import load_dotenv
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse

from .classify import classify_question
from .llm_client import ask_llm
from .query import handle_member_query, handle_party_query, handle_general_query

load_dotenv()

@csrf_exempt
def chatbot_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            question = data.get('question', '')

            if not question:
                return JsonResponse({'error': '질문이 비어 있습니다.'}, status=400)

            # 1. 질문 분류
            topic, keywords = classify_question(question)

            # 2. 주제에 따라 적절한 데이터 추출
            if topic == '국회의원':
                result_data = handle_member_query(keywords)
            elif topic == '정당':
                result_data = handle_party_query(keywords)
            else:
                result_data = handle_general_query(keywords)

            if not result_data:
                return JsonResponse({'answer': '관련 데이터를 찾을 수 없습니다.'})

            # 3. LLM 요약 요청
            prompt = f"다음 데이터를 기반으로 '{question}'에 대해 요약해서 답변해주세요:\n{result_data}"
            answer = ask_llm(prompt)

            return JsonResponse({'answer': answer})

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'error': 'POST 요청만 지원합니다.'}, status=405)
