import asyncio

import socketio

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)


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
