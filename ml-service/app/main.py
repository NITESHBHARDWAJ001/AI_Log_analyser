import logging
from contextlib import asynccontextmanager

import pandas as pd
from fastapi import Depends, FastAPI, HTTPException

from .config import settings
from .feature_engineering.web_attack import engineer_features
from .registry import registry
from .schemas import HealthResponse, WebAttackRequest, WebAttackResponse
from .security import verify_api_key

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ml-service")

WEB_ATTACK_MODEL = "web_attack"
# Registered once the second .pkl (multi-class security-event classifier) is provided —
# see README.md "Adding the second model" for the exact steps.
SECURITY_EVENT_MODEL = "security_event"


@asynccontextmanager
async def lifespan(app: FastAPI):
    registry.load(WEB_ATTACK_MODEL, "csic_web_attack_model.pkl")
    # registry.load(SECURITY_EVENT_MODEL, "organization_y_event_classifier.pkl")
    yield


app = FastAPI(title="AutoQual ML Service", version="1.0.0", lifespan=lifespan)


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok" if registry.loaded_models() else "degraded",
        models_loaded=registry.loaded_models(),
        models_failed=registry.load_errors(),
    )


@app.post("/predict/web-attack", response_model=WebAttackResponse, dependencies=[Depends(verify_api_key)])
def predict_web_attack(payload: WebAttackRequest):
    pipeline = registry.get(WEB_ATTACK_MODEL)
    if pipeline is None:
        # 503, not 500 — this tells the caller "retry later / fall back", not "your request was bad"
        raise HTTPException(status_code=503, detail=f"Model '{WEB_ATTACK_MODEL}' is not loaded")

    row = {
        "Method": payload.method,
        "Host-Header": payload.host_header,
        "Connection": payload.connection,
        "Accept": payload.accept,
        "Accept-Charset": payload.accept_charset,
        "Accept-Language": payload.accept_language,
        "Cache-control": payload.cache_control,
        "Pragma": payload.pragma,
        "User-Agent": payload.user_agent,
        "Content-Type": payload.content_type,
        "POST-Data": payload.post_data,
        "GET-Query": payload.get_query,
    }

    try:
        df_feat = engineer_features(pd.DataFrame([row]))
        proba = pipeline.predict_proba(df_feat)[0]
        pred = int(pipeline.predict(df_feat)[0])
    except Exception as exc:  # noqa: BLE001
        logger.exception("web-attack prediction failed")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc

    classes = list(pipeline.classes_)
    anomalous_probability = float(proba[classes.index(1)])
    is_anomalous = pred == 1

    return WebAttackResponse(
        model=WEB_ATTACK_MODEL,
        label="Anomalous" if is_anomalous else "Valid",
        is_anomalous=is_anomalous,
        confident=is_anomalous and anomalous_probability >= settings.ANOMALY_CONFIDENCE_THRESHOLD,
        confidence=float(max(proba)),
        anomalous_probability=anomalous_probability,
    )
