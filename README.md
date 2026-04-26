# Finance AI System

Backend for Personal Finance management, built with FastAPI + PostgreSQL.
The default Docker setup runs as microservices with a gateway and n8n automation.

## Run with Docker (Recommended)

```powershell
docker compose --profile micro up -d --build
```

Services:
- Gateway: `http://localhost:8005`
- Gateway Swagger: `http://localhost:8005/docs`
- n8n: `http://localhost:5678`
- PostgreSQL: `localhost:5431..5436`
- Redis (queue): `localhost:6379`

## Microservice-style

Run separate containers for `auth`, `finance`, `notifications`, `ai`, `notifications-worker`, `redis` plus a lightweight gateway proxy:

```powershell
docker compose --profile micro up -d --build
```

Endpoints:
- Gateway: `http://localhost:8005` (Swagger: `http://localhost:8005/docs`)
- Auth: `http://localhost:8001/docs`
- Finance: `http://localhost:8002/docs`
- Notifications: `http://localhost:8003/docs`
- AI: `http://localhost:8004/docs`

Queue:
- Redis: `localhost:6379`
- Notification jobs are enqueued to `notifications` and consumed by `notifications-worker`.

DB ownership:
- Auth -> `auth_db.auth_service`
- Finance -> `finance_db.finance_service`
- Notifications -> `notifications_db.notifications_service`
- AI stores chat/AI state in `ai_db.ai_service` and calls Finance via internal HTTP APIs.

If you are migrating from the old compose volume, re-init Postgres so the micro init script creates DB/schema:

```powershell
docker compose down -v
docker compose --profile micro up -d --build
```

## Run without Docker

```powershell
py -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### PostgreSQL note (when running without Docker)

If you run the API/seed scripts on Windows without Docker, make sure your local PostgreSQL has the user/database in `DB_URL`.

Default local config used by this project:
- user: `finance_user`
- password: `finance_pass`
- database: `finance_db`

Create them quickly (in `psql` as a superuser):

```sql
CREATE USER finance_user WITH PASSWORD 'finance_pass';
CREATE DATABASE finance_db OWNER finance_user;
GRANT ALL PRIVILEGES ON DATABASE finance_db TO finance_user;
```

Alternative (recommended): start the bundled Postgres container only:

```powershell
docker compose up -d finance-postgres
```

## Run Frontend (Web/Mobile)

```powershell
cd frontend
npm install
```

Web:

```powershell
npm run dev:web
```

Mobile (LAN access for phones):

```powershell
npm run dev:mobile
```

Open the app on your phone using `http://<LAN-IP>:5173`. The frontend will call the gateway API at `http://<LAN-IP>:8005/api/v1`.

## Seed 6-Month Demo Transactions

Create realistic income/expense data in DB (categories + tags + account + transactions) so charts/reports have full data immediately.

```powershell
python -m app.scripts.seed_recent_transactions --months 6
```

If you're running the stack with Docker, the most reliable way is to run the dedicated seed container:

```powershell
docker compose --profile micro --profile tools run --rm seed
```

Seed a specific email (PowerShell):

```powershell
$env:SEED_EMAIL="your_email@example.com"
docker compose --profile micro --profile tools run --rm seed
```

Seed a specific user:

```powershell
python -m app.scripts.seed_recent_transactions --email your_email@example.com --months 6
```

If user already has transactions in the seeded period, script skips by default. Use `--force` to replace last N months:

```powershell
python -m app.scripts.seed_recent_transactions --email your_email@example.com --months 6 --force
```

Create demo user and seed immediately (if not existing):

```powershell
python -m app.scripts.seed_recent_transactions --email demo@financeai.local --create-demo-user
```

## Environment Variables

From `.env` (tham khảo `.env.example`):

- `DB_URL`
- `DB_SCHEMA`
- `SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REDIS_URL`
- `QUEUE_DEFAULT_TIMEOUT`

### Gemini + SMTP Notes (Important)

- `GEMINI_API_KEY` is a personal API key. Do not commit it to git.
- `SMTP_PASSWORD` should NOT be shared/committed. For Gmail this is an "App Password" (16 characters), not your normal Gmail password, and requires 2-step verification.
- For local/dev without email, set `DEV_RETURN_OTP=true` and leave `SMTP_USER` / `SMTP_PASSWORD` empty.

### Dify (LLM) Optional

To enable LLM-backed NLP and chat intent parsing:

- `DIFY_API_BASE` (example: `http://localhost:5001/v1`)
- `DIFY_API_KEY`
- `DIFY_FORCE_JSON` (`true` to enforce JSON-only replies)
- `DIFY_SECRET_KEY`

If you run the bundled Dify stack, open:
- `http://localhost:5002` (Dify web)
- `http://localhost:5001` (Dify API)

See `docs/LLM_PROMPTS.md` for recommended prompt templates.
