from __future__ import annotations

from rq import Worker

from app.queue import get_redis_connection


def main() -> None:
    connection = get_redis_connection()
    worker = Worker(["notifications"], connection=connection)
    worker.work(with_scheduler=True)



if __name__ == "__main__":
    main()

