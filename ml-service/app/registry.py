import logging
from pathlib import Path

import joblib

from .config import settings

logger = logging.getLogger("ml-service")


class ModelRegistry:
    """Holds every loaded model by name. Models that fail to load (missing file,
    version-mismatch error, etc.) are simply absent from the registry rather than
    crashing the service — callers check is_loaded()/get() and the /health
    endpoint reports what's actually available, so a bad model doesn't take the
    whole service down."""

    def __init__(self):
        self._models: dict[str, object] = {}
        self._load_errors: dict[str, str] = {}

    def load(self, name: str, filename: str) -> None:
        path = Path(settings.MODELS_DIR) / filename
        if not path.exists():
            self._load_errors[name] = f"file not found: {path}"
            logger.warning("Model '%s' not loaded — %s", name, self._load_errors[name])
            return
        try:
            self._models[name] = joblib.load(path)
            logger.info("Loaded model '%s' from %s", name, path)
        except Exception as exc:  # noqa: BLE001 - any load failure should degrade, not crash
            self._load_errors[name] = str(exc)
            logger.exception("Failed to load model '%s' from %s", name, path)

    def get(self, name: str):
        return self._models.get(name)

    def is_loaded(self, name: str) -> bool:
        return name in self._models

    def loaded_models(self) -> list[str]:
        return list(self._models.keys())

    def load_errors(self) -> dict[str, str]:
        return dict(self._load_errors)


registry = ModelRegistry()
