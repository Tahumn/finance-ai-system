import os
import sys
import psycopg2

# Add workspace root to Python path
sys.path.insert(0, os.getcwd())

from app.auth.security import hash_password

try:
    # Hash the password using the app's hashing context
    hashed_pw = hash_password("Demo@1234")
    print(f"Hashed password: {hashed_pw}")

    # Connect to auth database
    conn = psycopg2.connect("postgresql://finance_user:finance_pass@localhost:5431/auth_db")
    cursor = conn.cursor()

    # Get column names
    cursor.execute("SELECT * FROM auth_service.users LIMIT 0")
    colnames = [desc[0] for desc in cursor.description]
    print(f"Columns in users table: {colnames}")

    # Insert test user
    cursor.execute(
        """
        INSERT INTO auth_service.users (email, username, hashed_password, is_active, email_verified)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (email) DO UPDATE 
        SET hashed_password = EXCLUDED.hashed_password, is_active = EXCLUDED.is_active, email_verified = EXCLUDED.email_verified
        """,
        ("demo@financeai.local", "demo_finance", hashed_pw, True, True)
    )
    conn.commit()
    print("Demo user 'demo@financeai.local' successfully created / updated in auth_db!")

    cursor.close()
    conn.close()
except Exception as e:
    print(f"Failed to create demo user: {e}")
