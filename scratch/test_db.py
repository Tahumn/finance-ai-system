import os
import sqlalchemy
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

def test_db():
    db_url = os.getenv("DB_URL")
    print(f"Testing DB_URL: {db_url}")
    try:
        # Use simple URL for test
        engine = sqlalchemy.create_engine(db_url)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("DB Connection: SUCCESS")
            print(f"Result: {result.fetchone()}")
            
            # Check tables
            from sqlalchemy import inspect
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            print(f"Tables: {tables}")
    except Exception as e:
        print(f"DB Connection: FAILED")
        print(f"Error: {e}")

if __name__ == "__main__":
    test_db()
