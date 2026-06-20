from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "LangAI Family"
    debug: bool = False
    database_url: str = "postgresql+psycopg2://langai:langai@db:5432/langai"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    ollama_url: str = "http://ollama:11434"
    ollama_model: str = "llama3.2:3b"
    whisper_model_size: str = "small"
    frontend_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
