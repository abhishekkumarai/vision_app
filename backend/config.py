"""
Configuration settings for MediaPipe & LLM Vision App.
Traceability: Epic KAN-49, Task KAN-50
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "MediaPipe Vision Lens & LLM"
    VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # MediaPipe Model Configuration
    MEDIAPIPE_MODEL_PATH: str = str(BASE_DIR / "backend" / "models" / "efficientdet_lite0.tflite")
    DETECTION_THRESHOLD: float = 0.45
    MAX_DETECTIONS: int = 6

    # LLM Settings
    # Options: 'ollama', 'gemini', 'mock'
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "ollama")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma2:2b")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # Event-driven workflows (KAN-89/90)
    EVENTS_DB_PATH: str = str(BASE_DIR / "backend" / "data" / "events.db")
    EVENT_COOLDOWN_SECONDS: float = 30.0

    # Static & Frontend paths
    FRONTEND_DIR: str = str(BASE_DIR / "frontend_static")

settings = Settings()
