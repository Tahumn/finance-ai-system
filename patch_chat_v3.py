import json
import os

file_path = "app/ai_agent/service.py"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

start_line = -1
end_line = -1

for i, line in enumerate(lines):
    if "def answer_chat(" in line:
        start_line = i
        break

if start_line == -1:
    print("FAILED: Start not found")
    exit(1)

for i in range(start_line + 1, len(lines)):
    if "def _otsu_threshold(" in lines[i]:
        end_line = i
        break

if end_line == -1:
    print("FAILED: End not found")
    exit(1)

# Logic mới của bạn đây:
new_body = r'''
def _call_gemini_chat(text: str) -> dict | None:
    if not settings.gemini_api_key:
        return None
    model = settings.gemini_model or "gemini-1.5-flash"
    base = (settings.gemini_api_base or "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
    url = f"{base}/models/{model}:generateContent?key={settings.gemini_api_key}"

    system_instruction = """Bạn là Trợ lý AI chuyên nghiệp tích hợp trong ứng dụng Quản lý Tài chính. Nhiệm vụ của bạn là phân tích ngôn ngữ tự nhiên của người dùng để trích xuất dữ liệu giao dịch hoặc truy vấn hệ thống.

1. Quy tắc Trích xuất Số tiền (Currency Normalization)
Bạn phải hiểu mọi cách nói về tiền của người Việt và chuyển đổi chúng thành Số nguyên (Integer) duy nhất:
'năm mươi nghìn', '50k', '50 ngàn' -> 50000
'hai triệu rưỡi', '2tr5', '2.5tr' -> 2500000
'một củ', 'một triệu' -> 1000000
'tám lít', 'tám trăm' -> 800000
Lưu ý: Nếu người dùng chỉ nói 'năm mươi', hãy dựa vào ngữ cảnh (ví dụ: ăn bát phở) để hiểu là 50000, không phải 50.

2. Phân loại Ý định (Intent & Entity Extraction)
Mọi câu nhập vào phải được trả về dưới định dạng JSON sau:
{
  "intent": "SAVE_EXPENSE" | "SAVE_INCOME" | "QUERY_HISTORY" | "UNKNOWN",
  "data": {
    "amount": (Số nguyên),
    "category": "Ăn uống" | "Di chuyển" | "Shopping" | "Lương" | "Thưởng",
    "note": "Nội dung",
    "date": "YYYY-MM-DD"
  },
  "friendly_response": "Câu trả lời thân thiện"
}
Lưu ý với QUERY_HISTORY, thay vi amount/category, hãy trả về:
"data": { "range": "current_week" | "current_month" | "today" }

3. Ràng buộc Thực tế (No Hallucination)
Không tự bịa: Nếu người dùng hỏi 'Tháng này tôi tiêu bao nhiêu?', bạn không được đưa ra con số. Hãy trả về intent: QUERY_HISTORY để hệ thống tự truy vấn Database.
Yêu cầu xác nhận: Với mỗi lệnh lưu, hãy phản hồi kèm một câu xác nhận số tiền bằng số để người dùng kiểm tra. (vd: 'Đã hiểu! Như vừa chi 50.000đ cho ăn trưa đúng không?')

4. Ví dụ mẫu (Few-shot)
User: 'Hôm qua đi chợ hết hai trăm rưỡi'
-> {"intent": "SAVE_EXPENSE", "data": {"amount": 250000, "category": "Shopping", "note": "đi chợ", "date": "yesterday"}, "friendly_response": "Đã ghi nhận! Bạn vừa chi 250.000đ đi chợ hôm qua đúng không?"}

User: 'Vừa nhận lương mười lăm củ'
-> {"intent": "SAVE_INCOME", "data": {"amount": 15000000, "category": "Lương", "note": "nhận lương", "date": "today"}, "friendly_response": "Tuyệt vời! Đã cộng 15.000.000đ từ tiền Lương vào tài khoản."}

User: 'Cho mình xem chi tiêu tuần này'
-> {"intent": "QUERY_HISTORY", "data": {"range": "current_week"}, "friendly_response": "Đây là thống kê chi tiêu của bạn:"}

Hãy luôn trả về JSON kèm theo một câu phản hồi thân thiện (friendly_response) cho người dùng."""

    import json, urllib.request
    payload = {
        "contents": [{"parts": [{"text": text}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {"responseMimeType": "application/json"}
    }
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as res:
            body = json.loads(res.read().decode("utf-8"))
            chat_text = body["candidates"][0]["content"]["parts"][0]["text"]
            return _extract_json(chat_text)
    except:
        return None

def answer_chat(db: Session, current_user: User, text: str) -> dict:
    llm_resp = _call_gemini_chat(text)
    if not llm_resp:
        return {"answer": "Lỗi AI. Vui lòng kiểm tra API Key.", "intent": "error", "start_date": None, "end_date": None, "category_name": None, "total": None}
    
    intent = llm_resp.get("intent", "UNKNOWN")
    data = llm_resp.get("data", {})
    friendly = llm_resp.get("friendly_response", "Đã nhận.")

    if intent in ("SAVE_EXPENSE", "SAVE_INCOME"):
        tx_type = "expense" if intent == "SAVE_EXPENSE" else "income"
        amount = _coerce_amount(data.get("amount"))
        if not amount:
            return {"answer": "Bạn cho mình số tiền nhé!", "intent": "create_transaction", "start_date": None, "end_date": None, "category_name": None, "total": None}
        
        cat_id, res_name = _resolve_category(db, current_user, data.get("category"), True)
        dt = _coerce_date_value(data.get("date")) or DateType.today()

        tx = finance_service.create_transaction(db, current_user, finance_schemas.TransactionCreate(
            description=data.get("note") or text, amount=amount, transaction_type=tx_type, category_id=cat_id, date=dt
        ))
        return {"answer": friendly, "intent": "create_transaction", "start_date": tx.date, "end_date": tx.date, "category_name": res_name, "total": tx.amount}

    if intent == "QUERY_HISTORY":
        range_v = data.get("range", "current_month")
        today = DateType.today()
        if range_v == "today": s, e = today, today
        elif range_v == "current_week": s, e = _week_range_for_date(today)
        else: s, e = _month_range_for_date(today)
        
        sum_data = finance_service.get_summary(db, current_user, start_date=s, end_date=e)
        return {"answer": f"{friendly}\n- Tổng thu: {sum_data.total_income:,.0f}đ\n- Tổng chi: {sum_data.total_expense:,.0f}đ", "intent": "summary", "start_date": s, "end_date": e, "category_name": None, "total": sum_data.total_expense}

    return {"answer": friendly, "intent": intent, "start_date": None, "end_date": None, "category_name": None, "total": None}
'''

lines[start_line:end_line] = [new_body + "\n"]

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("SUCCESS")
