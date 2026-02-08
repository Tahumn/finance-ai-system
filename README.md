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
uvicorn app.main:app --reload
```

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
