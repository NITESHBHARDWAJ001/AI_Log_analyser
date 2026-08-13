# AutoQual ML Service

FastAPI service that serves the trained security ML models behind AutoQual's backend.
Currently hosts the CSIC/ECML web-attack classifier (`Model 2` from the dataset plan);
built to register additional models without restructuring anything.

## Run locally

```bash
cd ml-service
python -m venv .venv
.venv/Scripts/activate   # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env     # set ML_SERVICE_API_KEY before exposing beyond localhost
uvicorn app.main:app --reload --port 8001
```

Health check: `GET http://localhost:8001/health` → `{"status": "ok", "models_loaded": ["web_attack"], "models_failed": {}}`

If a model file is missing or fails to load, it's simply absent from `models_loaded` (with
the reason in `models_failed`) — the service still starts and serves whatever did load,
rather than crashing entirely because one model is broken.

## Endpoints

### `POST /predict/web-attack`

Header: `X-API-Key: <ML_SERVICE_API_KEY>` (only enforced if the env var is set).

Request body — raw HTTP request fields, all optional except `method`:

```json
{
  "method": "GET",
  "host_header": "HTTP/1.1",
  "connection": "keep-alive",
  "accept": "text/html",
  "user_agent": "Mozilla/5.0 ...",
  "get_query": "id=1' UNION SELECT username,password FROM users--"
}
```

Response:

```json
{
  "model": "web_attack",
  "label": "Anomalous",
  "is_anomalous": true,
  "confident": true,
  "confidence": 0.998,
  "anomalous_probability": 0.998
}
```

`confident` is `true` only when `is_anomalous` AND `anomalous_probability >=
ANOMALY_CONFIDENCE_THRESHOLD` (default `0.85`, set via env var). The Node backend uses this
flag to decide whether to raise an Issue/Alert — a borderline call (e.g. ~54%) is reported
but doesn't fire an alert on its own, since a request that only marginally resembles training
data isn't strong enough evidence by itself.

Returns `503` if the model isn't loaded (backend should treat this as "fall back to Groq",
not "the request failed").

## Adding the second model (security-event classifier)

Once `organization_y_event_classifier.pkl` + `organization_y_label_encoder.pkl` are ready
(from `notebooks/organization_y_security_classifier.ipynb`):

1. Copy both `.pkl` files into `ml-service/models/`
2. Add a `app/feature_engineering/security_event.py` — port the `parse_line()` /
   feature-derivation logic from the training notebook (same principle as
   `feature_engineering/web_attack.py`: the saved pipeline expects derived columns
   `message_len`, `digit_count`, `special_char_count`, `suspicious_keyword_count`,
   `has_client_ip`, `log_type`, `message` — not raw log lines directly)
3. In `app/main.py`:
   - Uncomment `registry.load(SECURITY_EVENT_MODEL, "organization_y_event_classifier.pkl")`
   - Load the label encoder too (`registry.load("security_event_label_encoder", ...)`) —
     this model's `predict()` returns an integer class index, decode it with the encoder to
     get back the label string (e.g. `"bruteforce_login_web"`)
   - Add a `POST /predict/security-event` endpoint following the same shape as
     `predict_web_attack` above
4. Add the matching Pydantic request/response models to `app/schemas.py`

No other file needs to change — `ModelRegistry` already supports multiple named models,
and each endpoint is independent, so a broken/missing second model never affects the first.

## Why FastAPI as a separate service, not baked into the Node backend

Python owns the ML ecosystem (scikit-learn, XGBoost) that Node doesn't have natively. Keeping
it separate means retraining/redeploying a model doesn't require touching or redeploying the
Node backend, and a model-loading crash here can't take down the main API.
