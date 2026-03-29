import json
import os
import re

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
    print("Start marker NOT found!")
    exit(1)

for i in range(start_line + 1, len(lines)):
    if "def _otsu_threshold(" in lines[i]:
        end_line = i
        break

if end_line == -1:
    print("End marker NOT found!")
    exit(1)

print(f"Replacing lines {start_line+1} to {end_line}")

new_code = [
    "def _call_gemini_chat(text: str) -> dict | None:\n",
    "    if not settings.gemini_api_key:\n",
    '        print("Missing GEMINI_API_KEY")\n',
    "        return None\n",
    '    model = settings.gemini_model or "gemini-1.5-flash"\n',
    '    base = (settings.gemini_api_base or "https://generativelanguage.googleapis.com/v1beta").rstrip("/")\n',
    '    url = f"{base}/models/{model}:generateContent?key={settings.gemini_api_key}"\n',
    "\n",
    '    system_instruction = """Bạn là Trợ lý AI chuyên nghiệp tích hợp trong ứng dụng Quản lý Tài chính. Nhiệm vụ của bạn là phân tích ngôn ngữ tự nhiên của người dùng để trích xuất dữ liệu giao dịch hoặc truy vấn hệ thống.\n',
    "\n",
    "1. Quy tắc Trích xuất Số tiền (Currency Normalization)\n",
    "Bạn phải hiểu mọi cách nói về tiền của người Việt và chuyển đổi chúng thành Số nguyên (Integer) duy nhất:\n",
    "'năm mươi nghìn', '50k', '50 ngàn' -> 50000\n",
    "'hai triệu rưỡi', '2tr5', '2.5tr' -> 2500000\n",
    "'một củ', 'một triệu' -> 1000000\n",
    "'tám lít', 'tám trăm' -> 800000\n",
    "Lưu ý: Nếu người dùng chỉ nói 'năm mươi', hãy dựa vào ngữ cảnh (ví dụ: ăn bát phở) để hiểu là 50000, không phải 50.\n",
    "\n",
    "2. Phân loại Ý định (Intent & Entity Extraction)\n",
    "Mọi câu nhập vào phải được trả về dưới định dạng JSON sau:\n",
    "{\n",
    '  "intent": "SAVE_EXPENSE" | "SAVE_INCOME" | "QUERY_HISTORY" | "UNKNOWN",\n',
    '  "friendly_response": "Câu trả lời thân thiện",\n',
    '  "data": {\n',
    '    "amount": (Số nguyên),\n',
    '    "category": "Ăn uống" | "Di chuyển" | "Shopping" | "Lương" | "Thưởng",\n',
    '    "note": "Nội dung",\n',
    '    "date": "YYYY-MM-DD"\n',
    "  }\n",
    "}\n",
    'Lưu ý với QUERY_HISTORY, thay vi amount/category, hãy trả về:\n',
    '"data": { "range": "current_week" | "current_month" | "today" }\n',
    "\n",
    "3. Ràng buộc Thực tế (No Hallucination)\n",
    "Không tự bịa: Nếu người dùng hỏi 'Tháng này tôi tiêu bao nhiêu?', bạn không được đưa ra con số. Hãy trả về intent: QUERY_HISTORY để hệ thống tự truy vấn Database.\n",
    "Yêu cầu xác nhận: Với mỗi lệnh lưu, hãy phản hồi kèm một câu xác nhận số tiền bằng số để người dùng kiểm tra. (vd: 'Đã hiểu! Như vừa chi 50.000đ cho ăn trưa đúng không?')\n",
    "\n",
    "4. Ví dụ mẫu (Few-shot)\n",
    "User: 'Hôm qua đi chợ hết hai trăm rưỡi'\n",
    "-> {\"intent\": \"SAVE_EXPENSE\", \"friendly_response\": \"Đã ghi nhận! Bạn vừa chi 250.000đ đi chợ hôm qua đúng không?\", \"data\": {\"amount\": 250000, \"category\": \"Shopping\", \"note\": \"đi chợ\", \"date\": \"yesterday\"}}\n",
    "User: 'Vừa nhận lương mười lăm củ'\n",
    "-> {\"intent\": \"SAVE_INCOME\", \"friendly_response\": \"Tuyệt vời! Đã cộng 15.000.000đ từ tiền Lương vào tài khoản.\", \"data\": {\"amount\": 15000000, \"category\": \"Lương\", \"note\": \"nhận lương\", \"date\": \"today\"}}\n",
    "User: 'Cho mình xem chi tiêu tuần này'\n",
    "-> {\"intent\": \"QUERY_HISTORY\", \"friendly_response\": \"Đây là thống kê chi tiêu của bạn:\", \"data\": {\"range\": \"current_week\"}}\n",
    "\n",
    'LƯU Ý QUAN TRỌNG: CHỈ TRẢ VỀ JSON, KHÔNG KÈM TEXT NÀO KHÁC BÊN NGOÀI."""\n',
    "\n",
    "    payload = {\n",
    '        "contents": [{"parts": [{"text": text}]}],\n',
    '        "systemInstruction": {"parts": [{"text": system_instruction}]},\n',
    '        "generationConfig": {"responseMimeType": "application/json"}\n',
    "    }\n",
    '    data = json.dumps(payload).encode("utf-8")\n',
    "    import urllib.request\n",
    "    request = urllib.request.Request(\n",
    "        url,\n",
    "        data=data,\n",
    '        headers={"Content-Type": "application/json"},\n',
    '        method="POST",\n',
    "    )\n",
    "    try:\n",
    "        with urllib.request.urlopen(request, timeout=15) as response:\n",
    '            body = response.read().decode("utf-8")\n',
    "            response_json = json.loads(body)\n",
    '            candidates = response_json.get("candidates") or []\n',
    "            if candidates:\n",
    '                parts = candidates[0].get("content", {}).get("parts", [])\n',
    "                if parts:\n",
    '                    text_value = parts[0].get("text", "")\n',
    "                    return _extract_json(text_value)\n",
    "    except Exception as e:\n",
    '        print(f"Gemini API Error in Chat: {e}")\n',
    "    return None\n",
    "\n",
    "def answer_chat(\n",
    "    db: Session,\n",
    "    current_user: User,\n",
    "    text: str,\n",
    ") -> dict:\n",
    "    llm_resp = _call_gemini_chat(text)\n",
    "    if not llm_resp:\n",
    "        return {\n",
    '            "answer": "Xin lỗi, Hệ thống AI đang bận hoặc cấu hình API Key chưa đúng.",\n',
    '            "intent": "error",\n',
    "            \"start_date\": None,\n",
    "            \"end_date\": None,\n",
    "            \"category_name\": None,\n",
    "            \"total\": None,\n",
    "        }\n",
    "\n",
    '    intent = llm_resp.get("intent", "UNKNOWN")\n',
    '    friendly_response = llm_resp.get("friendly_response", "Đã xử lý xong.")\n',
    '    data = llm_resp.get("data", {})\n',
    "\n",
    '    if intent in ("SAVE_EXPENSE", "SAVE_INCOME"):\n',
    '        amount = _coerce_amount(data.get("amount"))\n',
    '        category_name = data.get("category")\n',
    '        note = data.get("note", "NLP transaction")\n',
    '        date_val = data.get("date")\n',
    "        \n",
    "        parsed_date = _parse_date(date_val) if date_val else DateType.today()\n",
    "        if not parsed_date:\n",
    "            parsed_date = DateType.today()\n",
    "\n",
    "        if not amount:\n",
    "            return {\n",
    '                "answer": "Bạn cho mình số tiền cụ thể nhé!",\n',
    '                "intent": "create_transaction",\n',
    "                \"start_date\": None,\n",
    "                \"end_date\": None,\n",
    "                \"category_name\": category_name,\n",
    "                \"total\": None,\n",
    "            }\n",
    "\n",
    '        transaction_type = "expense" if intent == "SAVE_EXPENSE" else "income"\n',
    "        category_id, resolved_name = _resolve_category(db, current_user, category_name, True)\n",
    "\n",
    "        tx_payload = finance_schemas.TransactionCreate(\n",
    "            description=note,\n",
    "            amount=amount,\n",
    "            transaction_type=transaction_type,\n",
    "            category_id=category_id,\n",
    "            account_id=None,\n",
    "            date=parsed_date,\n",
    "        )\n",
    "        created = finance_service.create_transaction(db, current_user, tx_payload)\n",
    "        return {\n",
    '            "answer": friendly_response,\n',
    '            "intent": "create_transaction",\n',
    "            \"start_date\": created.date,\n",
    "            \"end_date\": created.date,\n",
    "            \"category_name\": resolved_name,\n",
    "            \"total\": created.amount,\n",
    "        }\n",
    "\n",
    '    if intent == "QUERY_HISTORY":\n',
    '        range_val = data.get("range", "current_month")\n',
    "        today = DateType.today()\n",
    '        if range_val == "today":\n',
    "            start_date, end_date = today, today\n",
    '        elif range_val == "current_week":\n',
    "            start_date, end_date = _week_range_for_date(today)\n",
    "        else:\n",
    "            start_date, end_date = _month_range_for_date(today)\n",
    "            \n",
    "        summary = finance_service.get_summary(db, current_user, start_date=start_date, end_date=end_date)\n",
    "        return {\n",
    '            "answer": f"{friendly_response}\\n- Tổng chi: {summary.total_expense:,.0f}đ\\n- Tổng thu: {summary.total_income:,.0f}đ",\n',
    '            "intent": "summary",\n',
    "            \"start_date\": start_date,\n",
    "            \"end_date\": end_date,\n",
    "            \"category_name\": None,\n",
    "            \"total\": summary.total_expense,\n",
    "        }\n",
    "\n",
    "    return {\n",
    '        "answer": friendly_response,\n',
    '        "intent": intent,\n',
    "        \"start_date\": None,\n",
    "        \"end_date\": None,\n",
    "        \"category_name\": None,\n",
    "        \"total\": None,\n",
    "    }\n",
    "\n",
    "\n"
]

lines[start_line:end_line] = new_code

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("SUCCESS")
