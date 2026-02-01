# Finance AI Monolith (FastAPI + PostgreSQL)

## Cấu trúc thư mục
```
finance-ai-system/
├── app/
│   ├── main.py
│   ├── database.py
│   ├── core/
│   │   └── config.py
│   ├── auth/
│   │   ├── router.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── finance/
│   │   ├── router.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── ai_agent/
│   │   └── service.py
│   └── workflows/
│       └── triggers.py
└── requirements.txt
```

## Thiết lập môi trường (VS Code, Windows)
1) `py -m venv .venv`
2) `.\.venv\Scripts\activate`
3) `python -m pip install --upgrade pip`
4) `pip install -r requirements.txt`
5) Tạo `.env` từ `.env.example`, chỉnh `DB_URL=postgresql://user:pass@localhost:5432/finance_db`
6) VS Code: `Ctrl+Shift+P` → `Python: Select Interpreter` → chọn `.venv`
7) Chạy: `uvicorn app.main:app --reload`
8) Swagger: http://127.0.0.1:8000/docs

## Nguyên tắc refactor sang microservices
- Domain tách thư mục riêng (auth, finance, ai_agent, workflows); giữ router/service/schema cục bộ.
- Cross-cutting để tại `core/`, `database.py`; không nhúng logic domain.
- API version `/api/v1/<domain>` để copy module ra service riêng không đổi contract.
- Dùng DI qua FastAPI (`Depends`) thay cho global state; dễ thay repository bằng client service.

## Chạy nhanh kiểm tra
```
uvicorn app.main:app --reload
curl http://127.0.0.1:8000/health
```
