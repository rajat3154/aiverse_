import asyncio
import json
import os
import time
from typing import Any, Awaitable, Callable, Optional
import aio_pika
from aio_pika import ExchangeType, IncomingMessage, Message
from aio_pika.abc import AbstractChannel, AbstractRobustConnection
from dotenv import load_dotenv
from aiverse_logging import get_logger, log_event
from configurations.messages import get_message

load_dotenv()

log = get_logger("aiverse.ai_server.rabbitmq")

DOMAIN = "MESSAGE"


def _log(level, key, action, outcome, *args, duration_started_at=None, exc_info=False):
    context = None
    if duration_started_at is not None:
        context = {"duration_ms": round((time.monotonic() - duration_started_at) * 1000, 2)}
    log_event(log, level, get_message(key, *args), domain=DOMAIN, action=action, outcome=outcome, context=context, exc_info=exc_info)


class RabbitMQ:
    def __init__(self):
        self.url = os.getenv("RABBITMQ_URL")
        self.request_queue_name = os.getenv("RABBITMQ_REQUEST_QUEUE","aiverse.ai.requests")
        self.response_queue_name = os.getenv("RABBITMQ_RESPONSE_QUEUE","aiverse.ai.responses")
        self.exchange_name = os.getenv("RABBITMQ_EXCHANGE","aiverse")
        self.prefetch_count = int(os.getenv("RABBITMQ_PREFETCH_COUNT","10"))
        self.connection: Optional[AbstractRobustConnection] = None
        self.channel: Optional[AbstractChannel] = None
        self.exchange = None
        self.request_queue = None
        self.response_queue = None
        self.consumer_task: Optional[asyncio.Task] = None
        self._consumer_callback: Optional[Callable[[dict], Awaitable[None]]] = None

    async def connect(self):
        started_at = time.monotonic()
        if not self.url:
            _log("ERROR", "rabbitmq.connect.url.missing", "CONNECT", "FAILURE")
            raise RuntimeError(get_message("rabbitmq.connect.url.required"))
        try:
            _log("INFO", "rabbitmq.connect.started", "CONNECT", "STARTED")
            self.connection = await aio_pika.connect_robust(self.url)
            self.channel = await self.connection.channel()
            await self.channel.set_qos(prefetch_count=self.prefetch_count)
            self.exchange = await self.channel.declare_exchange(self.exchange_name,ExchangeType.DIRECT,durable=True)
            self.request_queue = await self.channel.declare_queue(self.request_queue_name,durable=True)
            self.response_queue = await self.channel.declare_queue(self.response_queue_name,durable=True)
            await self.request_queue.bind(self.exchange,routing_key=self.request_queue_name)
            await self.response_queue.bind(self.exchange,routing_key=self.response_queue_name)
            _log("INFO", "rabbitmq.connect.established", "CONNECT", "COMPLETED", duration_started_at=started_at)
            _log("INFO", "rabbitmq.connect.exchange", "CONNECT", "COMPLETED", self.exchange_name)
            _log("INFO", "rabbitmq.connect.request_queue", "CONNECT", "COMPLETED", self.request_queue_name)
            _log("INFO", "rabbitmq.connect.response_queue", "CONNECT", "COMPLETED", self.response_queue_name)
        except Exception as error:
            _log("ERROR", "rabbitmq.connect.failed", "CONNECT", "FAILURE", error, duration_started_at=started_at, exc_info=True)
            raise

    async def publish(self,routing_key: str,data: dict[str, Any],message_id: Optional[str] = None):
        started_at = time.monotonic()
        if not self.channel or self.channel.is_closed:
            _log("ERROR", "rabbitmq.publish.channel.unavailable", "PUBLISH", "FAILURE")
            raise RuntimeError(get_message("rabbitmq.publish.channel.unavailable"))
        try:
            body = json.dumps(data,ensure_ascii=False).encode("utf-8")
            message = Message(
                body=body,
                content_type="application/json",
                content_encoding="utf-8",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                message_id=message_id
            )
            await self.exchange.publish(message,routing_key=routing_key)
            _log("INFO", "rabbitmq.publish.completed", "PUBLISH", "COMPLETED", routing_key, duration_started_at=started_at)
        except Exception as error:
            _log("ERROR", "rabbitmq.publish.failed", "PUBLISH", "FAILURE", error, duration_started_at=started_at, exc_info=True)
            raise

    async def publish_request(self,data: dict[str, Any],message_id: Optional[str] = None):
        await self.publish(routing_key=self.request_queue_name,data=data,message_id=message_id)

    async def publish_response(self,data: dict[str, Any],message_id: Optional[str] = None):
        await self.publish(routing_key=self.response_queue_name,data=data,message_id=message_id)

    async def consume(self,callback: Callable[[dict], Awaitable[None]]):
        if not self.request_queue:
            _log("ERROR", "rabbitmq.consume.queue.unavailable", "CONSUME", "FAILURE")
            raise RuntimeError(get_message("rabbitmq.consume.queue.unavailable"))
        self._consumer_callback = callback
        _log("INFO", "rabbitmq.consume.starting", "CONSUME", "STARTED", self.request_queue_name)
        await self.request_queue.consume(self._handle_message)
        _log("INFO", "rabbitmq.consume.started", "CONSUME", "COMPLETED", self.request_queue_name)

    async def _handle_message(self,message: IncomingMessage):
        started_at = time.monotonic()
        try:
            async with message.process(requeue=True):
                body = message.body.decode("utf-8")
                data = json.loads(body)
                _log("INFO", "rabbitmq.message.received", "HANDLE_MESSAGE", "STARTED", self.request_queue_name)
                _log("DEBUG", "rabbitmq.message.id", "HANDLE_MESSAGE", "STARTED", message.message_id)
                if self._consumer_callback:
                    await self._consumer_callback(data)
        except json.JSONDecodeError as error:
            _log("ERROR", "rabbitmq.message.invalid_json", "HANDLE_MESSAGE", "REJECTED", error, duration_started_at=started_at)
        except Exception as error:
            _log("ERROR", "rabbitmq.message.failed", "HANDLE_MESSAGE", "FAILURE", error, duration_started_at=started_at, exc_info=True)
            raise

    async def close(self):
        try:
            if self.consumer_task:
                self.consumer_task.cancel()
                try:
                    await self.consumer_task
                except asyncio.CancelledError:
                    pass
            if self.connection and not self.connection.is_closed:
                await self.connection.close()
            _log("INFO", "rabbitmq.close.completed", "CLOSE", "COMPLETED")
        except Exception as error:
            _log("ERROR", "rabbitmq.close.failed", "CLOSE", "FAILURE", error, exc_info=True)

    async def health(self) -> bool:
        if not self.connection:
            return False
        return not self.connection.is_closed


rabbitmq = RabbitMQ()
