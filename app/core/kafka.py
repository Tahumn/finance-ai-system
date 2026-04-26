import asyncio
import json
import logging
import os
from typing import Any, Callable, Dict, Optional

from aiokafka import AIOKafkaProducer, AIOKafkaConsumer

logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")


class KafkaProducerManager:
    _instance: Optional["KafkaProducerManager"] = None

    def __init__(self):
        self.producer: Optional[AIOKafkaProducer] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    @classmethod
    def get_instance(cls) -> "KafkaProducerManager":
        if cls._instance is None:
            cls._instance = KafkaProducerManager()
        return cls._instance

    async def start(self):
        if not self.producer:
            self._loop = asyncio.get_running_loop()
            self.producer = AIOKafkaProducer(
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            )
            
            retries = 10
            while retries > 0:
                try:
                    await self.producer.start()
                    logger.info("Kafka Producer started")
                    return
                except Exception as e:
                    retries -= 1
                    logger.warning(f"Kafka Producer failed to start, retrying... ({retries} retries left): {e}")
                    await asyncio.sleep(5)
            
            raise Exception("Failed to start Kafka Producer after multiple retries")

    async def stop(self):
        if self.producer:
            await self.producer.stop()
            self.producer = None
            self._loop = None
            logger.info("Kafka Producer stopped")

    async def send(self, topic: str, value: Dict[str, Any], key: Optional[str] = None):
        if not self.producer:
            logger.warning(f"Kafka Producer not started. Dropping message to {topic}")
            return

        key_bytes = key.encode("utf-8") if key else None
        try:
            await self.producer.send_and_wait(topic, value=value, key=key_bytes)
            logger.debug(f"Sent message to {topic}")
        except Exception as e:
            logger.error(f"Error sending message to Kafka topic {topic}: {e}")

    def sync_send(self, topic: str, value: Dict[str, Any], key: Optional[str] = None):
        if not self.producer:
            logger.warning(f"Kafka Producer not started. Dropping message to {topic}")
            return

        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None

        # Called inside the same event loop that owns the producer.
        if current_loop and self._loop and current_loop is self._loop:
            current_loop.create_task(self.send(topic, value, key))
            return

        # Called from another thread (e.g., FastAPI sync endpoint). Schedule thread-safely
        # on the producer loop instead of creating a new loop, which breaks aiokafka futures.
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self.send(topic, value, key), self._loop)
            return

        logger.warning(
            "Kafka producer loop is unavailable. Dropping message to topic %s",
            topic,
        )


class KafkaConsumerManager:
    def __init__(self, topic: str, group_id: str, callback: Callable):
        self.topic = topic
        self.group_id = group_id
        self.callback = callback
        self.consumer: Optional[AIOKafkaConsumer] = None
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        self.consumer = AIOKafkaConsumer(
            self.topic,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id=self.group_id,
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            auto_offset_reset="earliest",
        )
        
        retries = 10
        while retries > 0:
            try:
                await self.consumer.start()
                logger.info(f"Kafka Consumer started for topic {self.topic}")
                self._task = asyncio.create_task(self._consume_loop())
                return
            except Exception as e:
                retries -= 1
                logger.warning(f"Kafka Consumer failed to start for topic {self.topic}, retrying... ({retries} retries left): {e}")
                await asyncio.sleep(5)
        
        raise Exception(f"Failed to start Kafka Consumer for topic {self.topic} after multiple retries")

    async def stop(self):
        if self._task:
            self._task.cancel()
        if self.consumer:
            await self.consumer.stop()
            logger.info(f"Kafka Consumer stopped for topic {self.topic}")

    async def _consume_loop(self):
        try:
            async for msg in self.consumer:
                try:
                    await self.callback(msg.value)
                except Exception as e:
                    logger.error(f"Error processing message in topic {self.topic}: {e}")
        except asyncio.CancelledError:
            pass


producer_manager = KafkaProducerManager()
