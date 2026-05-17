import psycopg2

try:
    # Connect to the finance postgres database on localhost:5432
    conn = psycopg2.connect("postgresql://finance_user:finance_pass@localhost:5432/finance_db")
    cursor = conn.cursor()

    # 1. Print columns in the budgets table
    cursor.execute("SELECT * FROM finance_service.budgets LIMIT 0")
    colnames = [desc[0] for desc in cursor.description]
    print(f"Columns in budgets table: {colnames}")

    # 2. Print all budget records
    cursor.execute("SELECT * FROM finance_service.budgets")
    rows = cursor.fetchall()
    print(f"\nAll budget records (Count: {len(rows)}):")
    for r in rows:
        print(r)

    # 3. Print categories
    cursor.execute("SELECT id, name, user_id FROM finance_service.categories")
    cats = cursor.fetchall()
    print(f"\nCategories (Count: {len(cats)}):")
    for c in cats[:10]:
        print(c)

    cursor.close()
    conn.close()
except Exception as e:
    print(f"Database error: {e}")
