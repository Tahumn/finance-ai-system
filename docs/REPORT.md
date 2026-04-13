# Finance AI Report (Draft)

## 1. Overview
- Goal: personal finance management with AI/NLP features (chat + natural language input).
- Scope: income/expense tracking, categories, reports, budgets, goals, debts, subscriptions, OCR.

## 2. Architecture
- Backend: FastAPI + SQLAlchemy + PostgreSQL (dev with create_all + minimal schema updates).
- Frontend: React (Vite).
- AI/NLP: rule-based intent + optional Dify JSON schema for structured parsing.
- OCR: pytesseract.

## 3. Database Schema (Summary)
- `users`, `categories`, `transactions` (+ `account_id`).
- `accounts`: wallet/bank accounts, opening balance, currency.
- `transfers`: account-to-account transfers.
- `budgets`: per-category or total monthly limits.
- `goals`: savings targets (amount + months).
- `debts`: creditor, amount, due date, status.
- `subscriptions`: recurring monthly charges (day-of-month).
- `reminders`: payment reminders (date + channel).

## 4. NLP / Chat Pipeline
- Intent detection: keyword rules + optional Dify schema (`docs/LLM_PROMPTS.md`).
- Slot filling: amount/date/category/account via regex + fallback clarification.
- Clarify rule: only ask when minimal data is missing (time, account, unit, category).

## 5. AI Features
- Anomaly detection: daily spend spikes vs mean + 2*std.
- Forecast: month-end spending based on run-rate.
- OCR: receipt parsing (merchant, total, date).

## 6. Evaluation (Mini)
- Prepare 30-50 queries (NLP + chat).
- Track intent accuracy, slot accuracy, and clarification success rate.

## 7. Deployment
- Docker Compose: API + Postgres.
- Optional cloud deployment (Render/Fly.io/Vercel).

## 8. Limitations
- NLP still rule-heavy; multi-intent queries may require clarification.
- OCR depends on image quality.
