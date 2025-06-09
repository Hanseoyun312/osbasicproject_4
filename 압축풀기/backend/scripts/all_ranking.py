import sqlite3
import pandas as pd
from pathlib import Path

# 기본 경로
BASE_DIR = Path(__file__).resolve().parent.parent
performance_db = BASE_DIR / "performance.db"
ranking_db = BASE_DIR / "ranking.db"
output_members_db = BASE_DIR / "ranking_members.db"
output_parties_db = BASE_DIR / "ranking_parties.db"

# 1. 국회의원 순위 계산
with sqlite3.connect(str(performance_db)) as conn:
    df_members = pd.read_sql_query("SELECT * FROM performance_score", conn)

# 순위 제외 대상 (컬럼은 유지, id만 삭제)
exclude_from_ranking = ["POLY_NM", "HG_NM", "id"]

ranking_fields_members = [
    col for col in df_members.columns
    if col not in exclude_from_ranking and pd.api.types.is_numeric_dtype(df_members[col])
]

for field in ranking_fields_members:
    df_members[f"{field}_순위"] = df_members[field].rank(ascending=False, method="min").astype(int)

if "id" in df_members.columns:
    df_members = df_members.drop(columns=["id"])

with sqlite3.connect(str(output_members_db)) as conn:
    df_members.to_sql("ranking_members", conn, if_exists="replace", index=False)


# 2. 정당 테이블 순위
with sqlite3.connect(str(ranking_db)) as conn:
    df_party_score = pd.read_sql_query("SELECT * FROM party_score", conn)
    df_party_stat = pd.read_sql_query("SELECT * FROM party_statistics_kr", conn)

# ✅ party_score: POLY_NM만 제외
for col in df_party_score.columns:
    if col != "POLY_NM" and pd.api.types.is_numeric_dtype(df_party_score[col]):
        df_party_score[f"{col}_순위"] = df_party_score[col].rank(ascending=False, method="min").astype(int)

# ✅ party_statistics_kr: 정당, id 제외
for col in df_party_stat.columns:
    if col not in ["정당", "id"] and pd.api.types.is_numeric_dtype(df_party_stat[col]):
        df_party_stat[f"{col}_순위"] = df_party_stat[col].rank(ascending=False, method="min").astype(int)

# 저장
with sqlite3.connect(str(output_parties_db)) as conn:
    df_party_score.to_sql("party_score", conn, if_exists="replace", index=False)
    df_party_stat.to_sql("party_statistics_kr", conn, if_exists="replace", index=False)
