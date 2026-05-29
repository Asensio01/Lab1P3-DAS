from pydantic import Field, PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    postgres_dsn: PostgresDsn = Field(..., alias="POSTGRES_DSN")
    redis_dsn: RedisDsn = Field(..., alias="REDIS_DSN")

    db_pool_size: int = Field(10, alias="DB_POOL_SIZE", ge=1)
    db_max_overflow: int = Field(20, alias="DB_MAX_OVERFLOW", ge=0)
    db_pool_timeout: int = Field(30, alias="DB_POOL_TIMEOUT", ge=1)
    db_pool_recycle: int = Field(1800, alias="DB_POOL_RECYCLE", ge=0)

    redis_socket_timeout: int = Field(5, alias="REDIS_SOCKET_TIMEOUT", ge=1)
    redis_socket_connect_timeout: int = Field(
        5, alias="REDIS_SOCKET_CONNECT_TIMEOUT", ge=1
    )

    postgres_password: str | None = Field(None, alias="POSTGRES_PASSWORD")

    jwt_secret: str = Field(..., alias="JWT_SECRET")
    jwt_issuer: str = Field("fintech-guard", alias="JWT_ISSUER")
    jwt_audience: str = Field("fintech-guard-api", alias="JWT_AUDIENCE")
    jwt_exp_seconds: int = Field(900, alias="JWT_EXP_SECONDS", ge=30)

    ip_burst_window_seconds: int = Field(60, alias="IP_BURST_WINDOW_SECONDS", ge=1)
    ip_burst_max: int = Field(50, alias="IP_BURST_MAX", ge=1)

    admin_username: str = Field("admin", alias="ADMIN_USERNAME")
    admin_password: str = Field(..., alias="ADMIN_PASSWORD")

    db_query_username: str = Field("auditor", alias="DB_QUERY_USERNAME")
    db_query_password: str = Field(..., alias="DB_QUERY_PASSWORD")

    environment: str = Field("production", alias="APP_ENV")
    log_level: str = Field("INFO", alias="LOG_LEVEL")

    vite_api_base_url: str | None = Field(None, alias="VITE_API_BASE_URL")
    vite_ws_url: str | None = Field(None, alias="VITE_WS_URL")
    vite_simulator_url: str | None = Field(None, alias="VITE_SIMULATOR_URL")


settings = Settings()
