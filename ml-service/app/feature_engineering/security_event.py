"""Feature engineering for the organization-y security-event classifier.

Ported verbatim from the training notebook
(notebooks/organization_y_security_classifier.ipynb). Must stay in sync with that
notebook — the saved pipeline's ColumnTransformer expects exactly the derived columns
produced here (message_len, digit_count, special_char_count, suspicious_keyword_count,
has_client_ip, log_type, message), not the raw fields directly.
"""

import pandas as pd

SUSPICIOUS_KEYWORDS = [
    "select", "union select", "<script", "javascript:", "../", "etc/passwd",
    "cmd.exe", "/bin/sh", "failed password", "invalid user", "authentication failure", "[sudo]",
]

# The raw fields this model needs per event, before feature engineering.
RAW_COLUMNS = ["message", "log_type", "client_ip"]


def _count_suspicious_keywords(text: str) -> int:
    text_lower = text.lower()
    return sum(text_lower.count(kw) for kw in SUSPICIOUS_KEYWORDS)


def engineer_features(raw_df: pd.DataFrame) -> pd.DataFrame:
    out = raw_df.copy()

    out["message"] = out["message"].fillna("")
    out["log_type"] = out["log_type"].fillna("unknown")

    out["message_len"] = out["message"].str.len()
    out["digit_count"] = out["message"].apply(lambda t: sum(ch.isdigit() for ch in t))
    out["special_char_count"] = out["message"].apply(
        lambda t: sum(t.count(c) for c in ["<", ">", "'", '"', ";", "%"])
    )
    out["suspicious_keyword_count"] = out["message"].apply(_count_suspicious_keywords)
    # notna() alone isn't enough for live inference — a caller can send "" rather
    # than omitting the field (unlike the training CSV, where missing was real NaN).
    if "client_ip" in out:
        out["has_client_ip"] = (out["client_ip"].notna() & (out["client_ip"] != "")).astype(int)
    else:
        out["has_client_ip"] = 0

    return out
