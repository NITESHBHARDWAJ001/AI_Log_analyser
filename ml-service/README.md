# AutoQual ML Service

FastAPI service that serves the trained security ML models behind AutoQual's backend.
Hosts two models — the CSIC/ECML web-attack classifier (`Model 2`) and the organization-y
multi-class security-event classifier (`Model 3`) — registered so a third can be added
without restructuring anything (see the bottom of this file).

## Run locally

```bash
cd ml-service
python -m venv .venv
.venv/Scripts/activate   # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env     # set ML_SERVICE_API_KEY before exposing beyond localhost
uvicorn app.main:app --reload --port 8001
```

Health check: `GET http://localhost:8001/health` → `{"status": "ok", "models_loaded": ["web_attack", "security_event", "security_event_label_encoder"], "models_failed": {}}`

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

### `POST /predict/security-event`

Multi-class classifier (`organization_y_event_classifier.pkl`), trained on real multi-source
server logs (Apache/Nginx access logs, syslog/auth.log, CyberPanel admin logs) rather than a
single HTTP request — classifies one **log line** into one of 7 categories: `benign`,
`bruteforce_login_server_attempt`, `bruteforce_login_web`, `cyberpanel_login_attempt`,
`cyberpanel_login_success`, `dir_scan`, `file_inclusion`.

Header: `X-API-Key: <ML_SERVICE_API_KEY>` (same as above).

Request body:

```json
{
  "message": "sshd: Failed password for root from 71.238.128.110 port 51728 ssh2",
  "log_type": "syslog",
  "client_ip": "71.238.128.110"
}
```

Response:

```json
{
  "model": "security_event",
  "label": "bruteforce_login_server_attempt",
  "is_benign": false,
  "confident": true,
  "confidence": 0.9999761873756601,
  "label_probabilities": { "benign": 0.00002, "bruteforce_login_server_attempt": 0.99998, "...": 0.0 }
}
```

`confident` is `true` only when the predicted label isn't `benign` AND its probability clears
`ANOMALY_CONFIDENCE_THRESHOLD` — same gating logic as `/predict/web-attack`, same reasoning
(a model that's only 99% sure this is normal doesn't need a "maybe not" alert).

The label encoder (`organization_y_label_encoder.pkl`) is registered separately under
`security_event_label_encoder` — the model's raw `predict()` returns an integer class index,
the encoder is what turns that back into a string like `"dir_scan"`.

`app/feature_engineering/security_event.py` derives `message_len`, `digit_count`,
`special_char_count`, `suspicious_keyword_count`, `has_client_ip` from the raw fields before
they hit the pipeline — ported verbatim from the training notebook and must stay in sync
with it if the notebook's feature engineering ever changes.

## Adding a third model

`ModelRegistry` already supports multiple named models, and each endpoint is independent, so
a broken/missing model never affects the others — follow the same shape as the two endpoints
above: drop the `.pkl` (+ label encoder, if not binary) into `models/`, add a
`feature_engineering/<name>.py` porting the training notebook's feature derivation, register
it in `main.py`'s `lifespan()`, add a `POST /predict/<name>` endpoint and matching Pydantic
schemas.

## Why FastAPI as a separate service, not baked into the Node backend

Python owns the ML ecosystem (scikit-learn, XGBoost) that Node doesn't have natively. Keeping
it separate means retraining/redeploying a model doesn't require touching or redeploying the
Node backend, and a model-loading crash here can't take down the main API.
