# Finance AI System

Backend monolith for Personal Finance management, built with FastAPI + PostgreSQL.
The stack also includes n8n for workflow automation.

## Current Status

- Auth is implemented with JWT (`register`, `login`, `me`).
- Finance module is implemented with user-scoped data:
  - Categories CRUD (create, list)
  - Transactions CRUD (create, list, update, delete)
  - Reports (`summary`, `category-breakdown`, `cashflow`)
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
uvicorn app.main:app --reload
```

## Run Frontend (Expo)

```powershell
cd frontend
npm install
npm run start
```

Notes:
- Frontend defaults to `http://localhost:8000/api/v1` and auto-detects LAN host from Expo bundle URL.
- To force a specific API URL, create `frontend/.env` from `frontend/.env.example` and set `EXPO_PUBLIC_API_URL`.
- If backend runs in Docker, make sure `docker compose up -d` exposes API on port `8000`.

## Environment Variables

From `.env.example`:

- `DB_URL`
- `SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`

## API Overview

Base URL: `/api/v1`

Auth:
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Finance:
- `POST /finance/categories`
- `GET /finance/categories`
- `PUT /finance/categories/{category_id}`
- `DELETE /finance/categories/{category_id}`
- `POST /finance/transactions`
- `GET /finance/transactions`
- `PUT /finance/transactions/{transaction_id}`
- `DELETE /finance/transactions/{transaction_id}`
- `GET /finance/reports/summary`
- `GET /finance/reports/category-breakdown`
- `GET /finance/reports/cashflow`

## Quick Test Flow in Swagger

1. `POST /api/v1/auth/register`
2. `POST /api/v1/auth/login` to get token
3. Click `Authorize` in Swagger:
   - `username` = your email
   - `password` = your password
4. `GET /api/v1/auth/me`
5. Create, update, delete transactions
6. Check summary, category breakdown, and cashflow reports

## Notes

- Tables are created on app startup with `Base.metadata.create_all()`.
- Data is persisted in Docker volume `postgres_data`.
- n8n is included for next step integration (agentic workflows / automations).
