import json

with open('db_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

filtered = [obj for obj in data if not obj['model'].startswith('contenttypes.')
            and not obj['model'].startswith('auth.')
            and not obj['model'].startswith('admin.')
            and not obj['model'].startswith('sessions.')]

with open('db_data_cleaned.json', 'w', encoding='utf-8') as f:
    json.dump(filtered, f, ensure_ascii=False, indent=2)

print(f"원래 항목 수: {len(data)}, 필터링 후: {len(filtered)}")
