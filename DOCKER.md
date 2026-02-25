# Docker Run Guide

## Start all services

```powershell
docker compose up -d --build
```

Services:
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- n8n: `http://localhost:5678`
- PostgreSQL: `localhost:5432`

## Stop services

```powershell
docker compose down
```

## Stop and remove volumes

```powershell
docker compose down -v
```
