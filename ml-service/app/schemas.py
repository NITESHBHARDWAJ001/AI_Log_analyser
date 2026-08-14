from pydantic import BaseModel


class WebAttackRequest(BaseModel):
    method: str = "GET"
    host_header: str = ""
    connection: str = ""
    accept: str = ""
    accept_charset: str = ""
    accept_language: str = ""
    cache_control: str = ""
    pragma: str = ""
    user_agent: str = ""
    content_type: str = ""
    post_data: str = ""
    get_query: str = ""

    class Config:
        json_schema_extra = {
            "example": {
                "method": "GET",
                "host_header": "HTTP/1.1",
                "connection": "keep-alive",
                "accept": "text/html",
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "get_query": "id=1' UNION SELECT username,password FROM users--",
            }
        }


class WebAttackResponse(BaseModel):
    model: str
    label: str  # "Valid" | "Anomalous"
    is_anomalous: bool
    confident: bool  # anomalous AND above ANOMALY_CONFIDENCE_THRESHOLD
    confidence: float
    anomalous_probability: float


class SecurityEventRequest(BaseModel):
    message: str
    log_type: str = "unknown"  # e.g. "access_log", "syslog", "cyberpanel_log", "generic"
    client_ip: str = ""

    class Config:
        json_schema_extra = {
            "example": {
                "message": "sshd: Failed password for root from 71.238.128.110 port 51728 ssh2",
                "log_type": "syslog",
                "client_ip": "71.238.128.110",
            }
        }


class SecurityEventResponse(BaseModel):
    model: str
    label: str  # e.g. "benign", "dir_scan", "bruteforce_login_web", ...
    is_benign: bool
    confident: bool  # non-benign AND above ANOMALY_CONFIDENCE_THRESHOLD
    confidence: float  # probability of the predicted class
    label_probabilities: dict[str, float]


class HealthResponse(BaseModel):
    status: str
    models_loaded: list[str]
    models_failed: dict[str, str]
