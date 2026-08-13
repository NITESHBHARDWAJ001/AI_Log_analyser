"""Feature engineering for the CSIC/ECML web-attack model.

Ported verbatim from the training notebook (notebooks/csic_ecml_web_attack_classifier.ipynb).
This MUST stay in sync with that notebook — the saved pipeline's ColumnTransformer expects
exactly the derived columns produced here, not the raw request fields directly.
"""

import re

import pandas as pd

SUSPICIOUS_PATTERNS = [
    r"select\s+.*\s+from", r"union\s+select", r"drop\s+table", r"insert\s+into",
    r"<script", r"javascript:", r"onerror\s*=", r"onload\s*=",
    r"\.\./", r"etc/passwd", r"cmd\.exe", r"/bin/sh",
    r"%3cscript", r"%27", r"--\s", r";\s*--", r"exec\s*\(", r"alert\s*\(",
]
SUSPICIOUS_RE = re.compile("|".join(SUSPICIOUS_PATTERNS), re.IGNORECASE)

TEXT_COLS = [
    "Host-Header", "Accept", "Accept-Charset", "Accept-Language",
    "Cache-control", "Pragma", "User-Agent", "Content-Type",
    "POST-Data", "GET-Query",
]

# The exact raw fields the model was trained on — used to build/validate the incoming DataFrame.
RAW_COLUMNS = ["Method", "Connection"] + TEXT_COLS


def engineer_features(raw_df: pd.DataFrame) -> pd.DataFrame:
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
