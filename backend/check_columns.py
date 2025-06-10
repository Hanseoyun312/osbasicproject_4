import sqlite3

db_path = 'performance.db'  # 필요시 경로 조정
conn = sqlite3.connect(db_path)

cursor = conn.execute("PRAGMA table_info(performance_score)")
print("📌 performance_score 테이블 컬럼 목록:")
for row in cursor.fetchall():
    print("-", row[1])

conn.close()
