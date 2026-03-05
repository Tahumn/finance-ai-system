#Mục tiêu: Xây dựng câu truy vấn SQL dựa trên entity
def build_total_query(
    *,
    user_id: int,
    transaction_type: str = "expense",
    category_id: int | None = None,
    month: int | None = None,
) -> tuple[str, dict]:
    query = """
    SELECT COALESCE(SUM(t.amount), 0) AS total
    FROM transactions t
    WHERE t.user_id = :user_id
      AND t.transaction_type = :transaction_type
    """
    params = {"user_id": user_id, "transaction_type": transaction_type}

    if category_id is not None:
        query += " AND t.category_id = :category_id"
        params["category_id"] = category_id

    if month is not None:
        query += " AND EXTRACT(MONTH FROM t.date) = :month"
        params["month"] = month

    return query, params
