# app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Declaramos solo lo que el simulador realmente va a usar
    BACKEND_URL: str = "http://localhost:8000"
    PORT: int = 8001
    INTERVALO_SEGUNDOS: float = 2.0

    # Esta línea le dice a Pydantic que ignore las variables sobrantes (POSTGRES, VITE, etc.)
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"  # <- EVITA EL ERROR DE EXTRA INPUTS
    )

settings = Settings()