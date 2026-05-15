from __future__ import annotations

from uuid import uuid4

from redis.asyncio import Redis


class RedisFraudStore:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def record_and_count(
        self, account_id: int, timestamp_ms: int, window_seconds: int
    ) -> int:
        key = f"fraud:account:{account_id}:tx"
        min_score = timestamp_ms - (window_seconds * 1000)
        member = f"{timestamp_ms}-{uuid4().hex}"

        pipeline = self._redis.pipeline()
        pipeline.zadd(key, {member: timestamp_ms})
        pipeline.zremrangebyscore(key, 0, min_score)
        pipeline.zcount(key, min_score, timestamp_ms)
        pipeline.expire(key, window_seconds * 2)
        results = await pipeline.execute()
        return int(results[2])
