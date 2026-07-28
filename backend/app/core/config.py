from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    sec_api_key: str = ""
    sec_api_base_url: str = "https://api.sec.or.th"
    data_dir: Path = Path("data")
    sec_cache_dir: Path = Path("data/sec")


settings = Settings()
