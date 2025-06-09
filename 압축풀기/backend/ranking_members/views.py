from django.shortcuts import render

# Create your views here.
import sqlite3
from django.http import JsonResponse
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / 'ranking_members.db'

def get_member_rankings(request):
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM ranking_members")
    data = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return JsonResponse(data, safe=False, json_dumps_params={'ensure_ascii': False})
