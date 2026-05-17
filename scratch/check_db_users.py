import psycopg2

try:
    # Connect to the auth postgres database on localhost:5431
    conn = psycopg2.connect("postgresql://finance_user:finance_pass@localhost:5431/auth_db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, username, is_active FROM auth_service.users")
    users = cursor.fetchall()
    print("Registered users in auth_db:")
    for user in users:
        print(f"ID: {user[0]}, Email: {user[1]}, Username: {user[2]}, Active: {user[3]}")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Failed to query database: {e}")
