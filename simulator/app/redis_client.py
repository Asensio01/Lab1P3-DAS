import redis
import json

redis_db = redis.Redis(host='fintech_redis', port=6379, db=0, decode_responses=True)