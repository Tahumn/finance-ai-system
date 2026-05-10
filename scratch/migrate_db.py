
from app.database import engine
from sqlalchemy import text

def migrate():
    print("Migrating database...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE bills ADD COLUMN image_path VARCHAR;"))
            print("Added image_path to bills")
        except Exception as e:
            print(f"Bills migration note: {e}")
            
        try:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN image_path VARCHAR;"))
            print("Added image_path to transactions")
        except Exception as e:
            print(f"Transactions migration note: {e}")
            
        conn.commit()
    print("Migration finished.")

if __name__ == "__main__":
    migrate()
