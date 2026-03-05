# Xác định mục đích câu hỏi/ý định của người dùng

def classify_intent(text: str) -> str:
    t = text.lower().strip()
    if not t:
        return "UNKNOWN"

    # Ưu tiên QUERY trước để tránh nhầm câu hỏi "bao nhiêu" thành ADD_EXPENSE
    if any(k in t for k in ["bao nhiêu", "bao nhieu", "tổng", "tong"]):
        return "QUERY"
    if any(k in t for k in ["phân tích", "phan tich", "có đang tiêu quá", "xu hướng", "xu huong"]):
        return "ANALYSIS"
    if any(k in t for k in ["chi", "mua", "trả", "thanh toán", "thanh toan"]):
        return "ADD_EXPENSE"
    if any(k in t for k in ["thu", "nhận", "luong", "lương", "hoàn", "refund"]):
        return "ADD_INCOME"

    return "UNKNOWN"
