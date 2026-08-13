import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings:
    # Shared secret checked against the X-API-Key header. Empty means auth is
    # disabled — fine for local dev, must be set before this is reachable from
    # anywhere but localhost.
    SERVICE_API_KEY = os.getenv("ML_SERVICE_API_KEY", "")
    MODELS_DIR = Path(os.getenv("MODELS_DIR", BASE_DIR / "models"))
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8001"))
    # Below this, a prediction is reported but not treated as a confident verdict —
    # the Node backend uses this same threshold to decide whether to raise an issue.
    ANOMALY_CONFIDENCE_THRESHOLD = float(os.getenv("ANOMALY_CONFIDENCE_THRESHOLD", "0.85"))


settings = Settings()
