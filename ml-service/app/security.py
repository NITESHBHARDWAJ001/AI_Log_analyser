from fastapi import Header, HTTPException, status

from .config import settings


async def verify_api_key(x_api_key: str | None = Header(default=None)):
    if not settings.SERVICE_API_KEY:
        # No key configured — auth disabled. Fine for local dev; set
        # ML_SERVICE_API_KEY before exposing this service beyond localhost.
        return
    if x_api_key != settings.SERVICE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key header",
        )
