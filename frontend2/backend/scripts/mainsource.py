import requests
import json

# 1. API URL 설정
api_url = "https://open.assembly.go.kr/portal/openapi/nwvrqwxyaytdsfvhu"

# 2. API 키 설정
api_key = "927928bf24af47d4afa7b805ed0bf4fc"

# 3. 요청 파라미터 설정
params = {
    "KEY": api_key,
    "Type": "json",
    "pIndex": "1",
    "pSize": "300"
}

# 4. API 요청 보내기
response = requests.get(api_url, params=params)

# 5. 응답 분석 및 필터링
if response.status_code == 200:
    try:
        # JSON 형식으로 변환
        data = response.json()
        
        # 'nwvrqwxyaytdsfvhu' 키의 리스트 확인
        if 'nwvrqwxyaytdsfvhu' in data and isinstance(data['nwvrqwxyaytdsfvhu'], list):
            api_list = data['nwvrqwxyaytdsfvhu']
            
            # 리스트의 길이 확인
            print(f"'nwvrqwxyaytdsfvhu' 리스트 길이: {len(api_list)}")
            
            # 두 번째 항목(인덱스 1) 확인
            if len(api_list) > 1:
                second_item = api_list[1]
                print("\n두 번째 항목 구조:")
                print(json.dumps(second_item, indent=2, ensure_ascii=False)[:500] + "..." if len(json.dumps(second_item)) > 500 else json.dumps(second_item, indent=2, ensure_ascii=False))
                
                # 두 번째 항목의 타입 확인
                print(f"\n두 번째 항목 타입: {type(second_item)}")
                
                # 두 번째 항목이 딕셔너리인 경우 키 확인
                if isinstance(second_item, dict):
                    print("\n두 번째 항목의 키:")
                    print(list(second_item.keys()))
                    
                    # 'row' 키가 있는지 확인
                    if 'row' in second_item and isinstance(second_item['row'], list):
                        rows = second_item['row']
                        print(f"\n'row' 데이터 개수: {len(rows)}")
                        
                        if len(rows) > 0:
                            # 첫 번째 row 항목의 키 확인
                            first_row = rows[0]
                            print("\n첫 번째 row 항목의 모든 키:")
                            for key, value in first_row.items():
                                print(f"- {key}: {value}")
                            
                            # 필터링을 위한 필드 매핑
                            target_fields = ["HG_NM", "POLY_NM", "MONA_CD", "CMITS", "TEL_NO", "E_MAIL", "HOMEPAGE"]
                            
                            # 발견된 필드 매핑
                            found_fields = {}
                            for field in target_fields:
                                found = False
                                # 정확히 일치하는 필드 확인
                                if field in first_row:
                                    found_fields[field] = field
                                    found = True
                                # 유사한 필드 찾기 (대소문자 구분 없이)
                                else:
                                    field_lower = field.lower()
                                    for key in first_row:
                                        key_lower = key.lower()
                                        if (field_lower == key_lower or 
                                            (field == "HG_NM" and ("name" in key_lower or "nm" in key_lower)) or
                                            (field == "POLY_NM" and ("party" in key_lower or "poly" in key_lower)) or
                                            (field == "MONA_CD" and ("code" in key_lower or "cd" in key_lower)) or
                                            (field == "CMITS" and ("committee" in key_lower or "cmit" in key_lower))):
                                            found_fields[field] = key
                                            found = True
                                            break
                                if not found:
                                    print(f"!!! 주의: '{field}' 필드 또는 유사한 필드를 찾을 수 없습니다.")
                            
                            print("\n필드 매핑 결과:")
                            for target, found in found_fields.items():
                                print(f"- {target} -> {found}")
                            
                            # 필터링된 데이터 생성
                            filtered_rows = []
                            for row in rows:
                                filtered_row = {}
                                for target, found in found_fields.items():
                                    filtered_row[target] = row.get(found, "")
                                filtered_rows.append(filtered_row)
                            
                            # 필터링된 결과 출력
                            filtered_data = {
                                "nwvrqwxyaytdsfvhu": filtered_rows
                            }
                            
                            print("\n필터링된 API 응답 결과:")
                            print(json.dumps(filtered_data, indent=4, ensure_ascii=False))
                            
                            # 파일로 저장
                            with open("filtered_members.json", "w", encoding="utf-8") as f:
                                json.dump(filtered_data, f, ensure_ascii=False, indent=2)
                            print(f"\n필터링된 데이터가 'filtered_members.json' 파일로 저장되었습니다.")
                        else:
                            print("'row' 데이터가 비어 있습니다.")
                    else:
                        print("'row' 키를 찾을 수 없거나 리스트가 아닙니다.")
                        
                        # row 대신 다른 구조인 경우
                        print("\n두 번째 항목의 데이터 구조 분석:")
                        if isinstance(second_item, dict):
                            for key, value in second_item.items():
                                print(f"- {key}: {type(value)}")
                                if isinstance(value, list) and len(value) > 0:
                                    print(f"  첫 번째 항목 키: {list(value[0].keys()) if isinstance(value[0], dict) else '딕셔너리 아님'}")
                # 두 번째 항목이 리스트인 경우
                elif isinstance(second_item, list):
                    print(f"\n두 번째 항목 리스트 길이: {len(second_item)}")
                    if len(second_item) > 0:
                        first_list_item = second_item[0]
                        print(f"\n첫 번째 리스트 항목 타입: {type(first_list_item)}")
                        if isinstance(first_list_item, dict):
                            print("첫 번째 리스트 항목 키:")
                            print(list(first_list_item.keys()))
            else:
                print("\n두 번째 항목이 없습니다. 첫 번째 항목만 확인:")
                first_item = api_list[0]
                print(json.dumps(first_item, indent=2, ensure_ascii=False))
        else:
            print("'nwvrqwxyaytdsfvhu' 키를 찾을 수 없거나 리스트가 아닙니다.")
            
    except json.JSONDecodeError:
        print("JSON 변환 실패. 응답 내용:")
        print(response.text[:1000])
else:
    print(f"API 요청 실패: {response.status_code}")
    print(response.text[:1000])
