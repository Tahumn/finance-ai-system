import psycopg2
import sys

try:
    conn = psycopg2.connect("postgresql://finance_user:finance_pass@localhost:5432/finance_db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, user_id FROM finance_service.categories")
    cats = cursor.fetchall()
    print("Database Categories:")
    for c in cats:
        # Safely print utf-8
        print(f"ID: {c[0]}, Name: {c[1]}, User ID: {c[2]}")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
