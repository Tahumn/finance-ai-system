# Finance AI System

Hệ thống quản lý tài chính cá nhân tích hợp AI, xây dựng bằng:

* FastAPI
* PostgreSQL
* React
* OCR hóa đơn
* Gemini API

## Chức năng chính

* Quản lý thu chi cá nhân
* Phân loại giao dịch bằng AI
* OCR scan hóa đơn
* Theo dõi ngân sách
* Dashboard thống kê tài chính
* Chat hỗ trợ nhập giao dịch nhanh

---

## Chạy bằng Docker (Khuyến nghị)

```powershell
docker compose up -d --build
```

Các service:

* API: `http://localhost:8000`
* Swagger Docs: `http://localhost:8000/docs`
* PostgreSQL: `localhost:5432`

---

## Chạy local không dùng Docker

```powershell
py -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

---

## Chạy Frontend

```powershell
cd frontend
npm install
```

Web:

```powershell
npm run dev:web
```

Mobile:

```powershell
npm run dev:mobile
```

---

## Seed dữ liệu demo

Sinh dữ liệu giao dịch mẫu để test dashboard/report:

```powershell
python -m app.scripts.seed_recent_transactions --months 6
```

---

## Environment Variables

Cấu hình trong file `.env`:

* `DB_URL`
* `SECRET_KEY`
* `GEMINI_API_KEY`
* `SMTP_USER`
* `SMTP_PASSWORD`

---

## Ghi chú

* Không commit API key hoặc SMTP password lên git
* Có thể bật `DEV_RETURN_OTP=true` để test local không cần email
* OCR hiện hỗ trợ scan hóa đơn cơ bản, một số format đặc biệt có thể nhận diện chưa chính xác
* Một số phần AI classify vẫn đang tiếp tục tinh chỉnh
