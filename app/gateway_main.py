from __future__ import annotations

import os
from typing import Iterable

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import StreamingResponse

from app.realtime import socket_app


def _service_url(env_key: str, default: str) -> str:
    return os.getenv(env_key, default).rstrip("/")


AUTH_SERVICE_URL = _service_url("AUTH_SERVICE_URL", "http://auth:8000")
FINANCE_SERVICE_URL = _service_url("FINANCE_SERVICE_URL", "http://finance:8000")
NOTIFICATIONS_SERVICE_URL = _service_url(
    "NOTIFICATIONS_SERVICE_URL", "http://notifications:8000"
)
AI_SERVICE_URL = _service_url("AI_SERVICE_URL", "http://ai:8000")
PLANNING_SERVICE_URL = _service_url("PLANNING_SERVICE_URL", "http://planning:8000")
RECURRING_SERVICE_URL = _service_url("RECURRING_SERVICE_URL", "http://recurring:8000")
OCR_SERVICE_URL = _service_url("OCR_SERVICE_URL", "http://ocr:8000")



def _pick_upstream(path: str) -> str:
    if path.startswith("/api/v1/auth"):
        return AUTH_SERVICE_URL
    if path.startswith("/api/v1/finance"):
        return FINANCE_SERVICE_URL
    if path.startswith("/api/v1/notifications"):
        return NOTIFICATIONS_SERVICE_URL
    if path.startswith("/api/v1/ai"):
        return AI_SERVICE_URL
    if path.startswith("/api/v1/planning"):
        return PLANNING_SERVICE_URL
    if path.startswith("/api/v1/recurring"):
        return RECURRING_SERVICE_URL
    if path.startswith("/api/v1/ocr"):
        return OCR_SERVICE_URL
    raise KeyError(path)


app = FastAPI(title="Finance AI Gateway")

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", ",".join(DEFAULT_CORS_ORIGINS)).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):\d+$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck():
    return {"status": "ok", "mode": "gateway"}


@app.api_route(
    "/api/v1/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy_api_v1(full_path: str, request: Request) -> Response:
    upstream = _pick_upstream(f"/api/v1/{full_path}")
    url = f"{upstream}/api/v1/{full_path}"

    headers = dict(request.headers)
    headers.pop("host", None)

    params = request.query_params
    body = await request.body()

    async with httpx.AsyncClient(timeout=None) as client:
        upstream_response = await client.request(
            request.method,
            url,
            params=params,
            content=body,
            headers=headers,
        )

    excluded: Iterable[str] = {
        "content-encoding",
        "transfer-encoding",
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "upgrade",
    }
    response_headers = {
        k: v for k, v in upstream_response.headers.items() if k.lower() not in excluded
    }

    return StreamingResponse(
        upstream_response.aiter_bytes(),
        status_code=upstream_response.status_code,
        headers=response_headers,
        media_type=upstream_response.headers.get("content-type"),
    )


# Keep websocket support on the gateway for now (no WS proxy in this MVP gateway).
if not os.path.exists("uploads"):
    os.makedirs("uploads")

app.mount("/ws", socket_app)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

