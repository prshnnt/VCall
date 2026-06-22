from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Cloudflare TURN
    cf_account_id: str = ""
    cf_turn_token: str = ""
    cf_turn_ttl: int = 86400

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # App
    app_secret_key: str = "change_me"
    room_max_peers: int = 10
    session_ttl: int = 3600


@lru_cache
def get_settings() -> Settings:
    return Settings()
