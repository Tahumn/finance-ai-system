#Mục tiêu: Cung cấp các hàm phân tích tài chính, như tính toán tỷ lệ tiết kiệm, tăng trưởng, điểm số tài chính, và phát hiện bất thường trong chi tiêu.
#Analytics engine giúp hệ thống: phân tích tài chính, phát hiện chi tiêu bất thường, tính điểm tài chính
from statistics import mean, pstdev

def calculate_savings_rate(total_income: float, total_expense: float) -> float:
    if total_income <= 0:
        return 0.0
    return (total_income - total_expense) / total_income * 100

def calculate_growth(current: float, previous: float) -> float:
    if previous <= 0:
        return 0.0
    return (current - previous) / previous * 100

def calculate_financial_score(savings_rate: float, stability: float, budget_adherence: float) -> float:
    score = 0.4 * savings_rate + 0.3 * stability + 0.3 * budget_adherence
    return min(score, 100.0)

def detect_anomaly(expenses: list[float]) -> list[float]:
    if not expenses:
        return []
    avg = mean(expenses)
    sd = pstdev(expenses)
    threshold = avg + 2 * sd
    return [x for x in expenses if x > threshold]
