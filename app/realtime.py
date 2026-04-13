from __future__ import annotations

import asyncio

import socketio

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
_raw_socket_app = socketio.ASGIApp(sio)


class _StripMountPrefix:
    """
    Starlette/FastAPI mounts may leave the mount prefix in `scope["path"]` for websockets in some versions.
    python-engineio expects the path to start with `/socket.io/` for websocket upgrade requests.

    This middleware strips `scope["root_path"]` from `scope["path"]` if it is duplicated to avoid
    `engineio` falling back to `not_found()` (which sends an HTTP response on a websocket scope).
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") in {"http", "websocket"}:
            root_path = scope.get("root_path") or ""
            path = scope.get("path") or ""
            if root_path and path.startswith(root_path):
                new_path = path[len(root_path) :]
                if not new_path.startswith("/"):
                    new_path = "/" + new_path
                scope = dict(scope)
                scope["path"] = new_path or "/"
        return await self.app(scope, receive, send)


socket_app = _StripMountPrefix(_raw_socket_app)


def emit_event(event: str, data: dict) -> None:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        asyncio.run(sio.emit(event, data))
        return
    loop.create_task(sio.emit(event, data))


def emit_finance_update(scope: str, user_id: int | None = None, resource_id: int | None = None) -> None:
    emit_event(
        "finance:update",
        {
            "scope": scope,
            "user_id": user_id,
            "resource_id": resource_id
        }
    )
