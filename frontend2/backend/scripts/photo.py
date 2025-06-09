import requests
import json
#국회의원 정보통합api
# 1. API 주소와 키 설정
url = "https://open.assembly.go.kr/portal/openapi/ALLNAMEMBER"
key = "927928bf24af47d4afa7b805ed0bf4fc"

# 2. 요청 파라미터 설정
params = {
    "KEY": key,
    "Type": "json",
    "pIndex": 1,
    "pSize": 300,
    "age": 22
}

# 3. API 요청 보내기
response = requests.get(url, params=params)

# 4. 요청이 성공했을 때만 진행
if response.status_code == 200:
    try:
        data = response.json()

        # 5. 최상위 키 자동으로 찾기
        if len(data) != 1: #len(data)는 딕셔너리 최상위 키의 개수
            print("⚠️ 응답 구조가 예상과 다릅니다.")
        else:
            root_key = next(iter(data))  # 첫 번째 키 추출 
            #iter(data)는 키를 하나씩 꺼낼 수 있는 반복자를 만들어줌, next는 호출할때마다 키를 하나씩 꺼내줌
            items = data.get(root_key, []) #data에 root_key라는 키가 있다면 그 키가 가진값 반환, 없으면 기본인자 []반환(오류방지지) 

            # 6. 실제 row 데이터 추출
            if len(items) > 1 and "row" in items[1]: #items에 두번재 항목이 있는지 확인하고, items[1]에 row가 있는지
                rows = items[1]["row"]

                # 7. 필요한 정보만 추출해서 새 리스트 만들기
                result = []
                for row in rows:
                    info = {
                        "이름": row.get("NAAS_NM", ""),
                        "의원코드": row.get("NAAS_CD", ""),
                        "사진":row.get("NAAS_PIC","")
                    }
                    result.append(info)

                # 8. 결과 출력
                print(json.dumps(result, ensure_ascii=False, indent=2)) 
                #dumps는 문자열화(json이나 딕셔너리과 같은 파이썬 객체를),ensure_ascii=False는 한글 그대로 출력

                # 9. 파일로 저장
                with open("photo.json", "w", encoding="utf-8") as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)
                print("✅ 파일 저장 완료: filtered_members_simple.json")
            else:
                print("⚠️ row 데이터가 없거나 구조가 다릅니다.")
    except json.JSONDecodeError:
        print("❌ JSON 파싱 실패. 응답 내용:")
        print(response.text[:500])
else:
    print(f"❌ 요청 실패: {response.status_code}")