# Finance AI System

Backend monolith for Personal Finance management, built with FastAPI + PostgreSQL.
The stack also includes n8n for workflow automation.

## Run with Docker (Recommended)

```powershell
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

Web:

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

