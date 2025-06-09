import requests
import math
from legislation.models import Petition  # Django 모델 import

api_key = "927928bf24af47d4afa7b805ed0bf4fc"
api_url = "https://open.assembly.go.kr/portal/openapi/ncryefyuaflxnqbqo"
p_size = 1000
age = "22"

def fetch_and_store_petitions():
    params = {
        "KEY": api_key,
        "Type": "json",
        "pIndex": "1",
        "pSize": str(p_size),
        "AGE": age
    }

    page_num = 1
    print("📡 첫 페이지 호출 중...")
    
    while True:
        params['pIndex'] = str(page_num)
        response = requests.get(api_url, params=params)
        
        if response.status_code != 200:
            print("❌ API 요청 실패")
            break

        data = response.json()
        if 'ncryefyuaflxnqbqo' not in data or not isinstance(data['ncryefyuaflxnqbqo'], list):
            break

        api_list = data['ncryefyuaflxnqbqo']
        if len(api_list) <= 1:
            break

        second_item = api_list[1]
        if not isinstance(second_item, dict) or 'row' not in second_item:
            break

        rows = second_item['row']
        if not rows:
            break

        for row in rows:
            BILL_ID = row.get("BILL_ID", "")
            BILL_NO = row.get("BILL_NO", "")
            BILL_NAME = row.get("BILL_NAME", "")
            PROPOSER = row.get("PROPOSER", "")
            PROC_RESULT_CD = row.get("PROC_RESULT_CD", "")
            DETAIL_LINK = row.get("LINK_URL", "")  # 의안 링크 추가
            PROPOSE_DT = row.get("PROPOSE_DT", "")  # 청원 접수 일자 추가

            # Django DB에 저장 (업데이트 or 추가)
            Petition.objects.update_or_create(
                BILL_ID=BILL_ID,
                defaults={
                    "BILL_NO": BILL_NO,
                    "BILL_NAME": BILL_NAME,
                    "PROPOSER": PROPOSER,
                    "PROC_RESULT_CD": PROC_RESULT_CD,
                    "DETAIL_LINK": DETAIL_LINK,  # 의안 링크 반영
                    "PROPOSE_DT": PROPOSE_DT,  # 청원 접수 일자 반영
                }
            )

        page_num += 1  # 다음 페이지로 이동

    print(f"✅ 청원 데이터 {Petition.objects.count()}개 저장 완료!")