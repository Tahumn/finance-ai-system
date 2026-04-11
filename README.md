# Finance AI System

Backend monolith for Personal Finance management, built with FastAPI + PostgreSQL.
The stack also includes n8n for workflow automation.

## Current Status

- Auth is implemented with JWT (`register`, `login`, `me`).
- Finance module is implemented with user-scoped data:
  - Categories CRUD (create, list)
  - Transactions CRUD (create, list, update, delete)
  - Reports (`summary`, `category-breakdown`)
- Dockerized runtime is ready (`api`, `postgres`, `n8n`).
- Swagger login works with both:
  - JSON body (`email`, `password`) for app clients
  - OAuth2 form (`username`, `password`) for Swagger Authorize popup

## Tech Stack

- FastAPI
- SQLAlchemy
- PostgreSQL
- JWT (`python-jose`)
- Password hashing (`passlib`, `pbkdf2_sha256`)
- Docker Compose
- n8n

## Project Structure

```text
finance-ai-system/
|-- app/
|   |-- main.py
|   |-- database.py
|   |-- core/
|   |   `-- config.py
|   |-- auth/
|   |   |-- models.py
|   |   |-- router.py
|   |   |-- schemas.py
|   |   |-- security.py
|   |   `-- service.py
|   |-- finance/
|   |   |-- models.py
|   |   |-- router.py
|   |   |-- schemas.py
|   |   `-- service.py
|   |-- ai_agent/
|   `-- workflows/
|-- docker-compose.yml
|-- Dockerfile
|-- requirements.txt
|-- .env.example
`-- DOCKER.md
```

## Run with Docker (Recommended)

```powershell
cd C:\Users\NHU\finance-ai-system
docker compose up -d --build
```

Services:
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- n8n: `http://localhost:5678`
- PostgreSQL: `localhost:5432`

## Run without Docker

```powershell
py -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Run Frontend (Web/Mobile)

```powershell
cd frontend
npm install
```

Web (desktop layout):

```powershell
npm run dev:web
```

Mobile (LAN access for phones):

```powershell
npm run dev:mobile
```

Open the app on your phone using `http://<LAN-IP>:5173`. The frontend will call the same API at `http://<LAN-IP>:8000/api/v1`.

## Environment Variables

From `.env` (tham khảo `.env.example`):

- `DB_URL`
- `SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`

### Gemini + SMTP Notes (Important)

- `GEMINI_API_KEY` is a personal API key. Do not commit it to git. Each developer should create their own key (or run without Gemini and use the fallback parsing).
- `SMTP_PASSWORD` should NOT be shared/committed. For Gmail this is an "App Password" (16 characters), not your normal Gmail password, and requires 2-step verification.
- For local/dev without email, set `DEV_RETURN_OTP=true` and leave `SMTP_USER` / `SMTP_PASSWORD` empty.

### Dify (LLM) Optional

To enable LLM-backed NLP and chat intent parsing:

- `DIFY_API_BASE` (example: `http://localhost:5001/v1`)
- `DIFY_API_KEY`
- `DIFY_FORCE_JSON` (`true` to enforce JSON-only replies)
- `DIFY_SECRET_KEY` (used by Dify services)

If you run the bundled Dify stack, open:
- `http://localhost:5002` (Dify web)
- `http://localhost:5001` (Dify API)

See `docs/LLM_PROMPTS.md` for recommended prompt templates.

## API Overview

Base URL: `/api/v1`

Auth:
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Finance:
- `POST /finance/categories`
- `GET /finance/categories`
- `POST /finance/transactions`
- `GET /finance/transactions`
- `PUT /finance/transactions/{transaction_id}`
- `DELETE /finance/transactions/{transaction_id}`
- `GET /finance/reports/summary`
- `GET /finance/reports/category-breakdown`

## Quick Test Flow in Swagger

1. `POST /api/v1/auth/register`
2. `POST /api/v1/auth/login` to get token
3. Click `Authorize` in Swagger:
   - `username` = your email
   - `password` = your password
4. `GET /api/v1/auth/me`
5. Create category and transactions
6. Check summary and category breakdown reports

## Notes

- Tables are created on app startup with `Base.metadata.create_all()`.
- Data is persisted in Docker volume `postgres_data`.
- n8n is included for next step integration (agentic workflows / automations).
