import os
import json
import sqlite3
import pandas as pd
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 경로 설정
PERFORMANCE_DB = os.path.join(BASE_DIR, 'performance.db')
RANKING_DB = os.path.join(BASE_DIR, 'ranking.db')
MEMBER_OUTPUT_DB = os.path.join(BASE_DIR, 'weights_members.db')
PARTY_OUTPUT_DB = os.path.join(BASE_DIR, 'weights_parties.db')

@csrf_exempt
@require_POST
def update_weights(request):
    try:
        data = json.loads(request.body)
        weights = data.get("weights", {})

        if not weights:
            return JsonResponse({"status": "error", "message": "weights 값이 없습니다"}, status=400)

        # 의원 점수 계산 및 저장
        calculate_weights_for_members(weights)

        # 정당 점수 계산 및 저장
        calculate_weights_for_parties(weights)

        return JsonResponse({"status": "success", "message": "weights_members.db, weights_parties.db 생성 완료"})

    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


def calculate_weights_for_members(weights):
    conn = sqlite3.connect(PERFORMANCE_DB)
    df = pd.read_sql_query("SELECT * FROM performance_score", conn)
    conn.close()

    # 가중치 적용
    for field, weight in weights.items():
        if field in df.columns:
            df[field + '_w'] = df[field] * (weight / 100)

    df['weighted_total'] = df[[col for col in df.columns if col.endswith('_w')]].sum(axis=1)
    df['rank'] = df['weighted_total'].rank(ascending=False, method='min').astype(int)

    conn = sqlite3.connect(MEMBER_OUTPUT_DB)
    df[['HG_NM', 'POLY_NM', 'weighted_total', 'rank']].to_sql("weights_members", conn, if_exists='replace', index=False)
    conn.close()


def calculate_weights_for_parties(weights):
    conn = sqlite3.connect(RANKING_DB)
    df = pd.read_sql_query("SELECT * FROM party_statistics_kr", conn)
    conn.close()

    for field, weight in weights.items():
        if field in df.columns:
            df[field + '_w'] = df[field] * (weight / 100)

    df['weighted_total'] = df[[col for col in df.columns if col.endswith('_w')]].sum(axis=1)
    df['rank'] = df['weighted_total'].rank(ascending=False, method='min').astype(int)

    conn = sqlite3.connect(PARTY_OUTPUT_DB)
    df[['정당명', 'weighted_total', 'rank']].to_sql("weights_parties", conn, if_exists='replace', index=False)
    conn.close()
