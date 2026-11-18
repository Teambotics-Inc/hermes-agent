"""Dedicated pairing and session-list routes for the mobile companion."""

import base64
import hmac
import io
import secrets
import threading
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException

router = APIRouter()
_lock = threading.RLock()


def _token_path() -> Path:
    from hermes_constants import get_hermes_home

    return Path(get_hermes_home()) / "companion_token"


def _read_or_create_token() -> str:
    from utils.files import atomic_write_text

    path = _token_path()
    with _lock:
        try:
            token = path.read_text(encoding="utf-8").strip()
            if token:
                return token
        except FileNotFoundError:
            pass
        token = secrets.token_urlsafe(32)
        atomic_write_text(path, token + "\n", mode=0o600)
        return token


def _require_token(authorization: str | None) -> None:
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if not hmac.compare_digest(supplied, _read_or_create_token()):
        raise HTTPException(401, "Unauthorized", headers={"WWW-Authenticate": "Bearer"})


@router.get("/api/companion/pairing")
def pairing_info():
    token = _read_or_create_token()
    try:
        import qrcode
    except ImportError as exc:
        raise HTTPException(503, "QR support unavailable") from exc
    buffer = io.BytesIO()
    qrcode.make(token).save(buffer, format="PNG")
    return {"token": token, "qr": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")}


@router.post("/api/companion/rotate")
def rotate_token(authorization: str | None = Header(default=None)):
    from utils.files import atomic_write_text

    _require_token(authorization)
    token = secrets.token_urlsafe(32)
    with _lock:
        atomic_write_text(_token_path(), token + "\n", mode=0o600)
    return {"token": token}


@router.get("/api/companion/sessions")
def companion_sessions(authorization: str | None = Header(default=None)):
    _require_token(authorization)
    from hermes_cli.web_routers.sessions import get_sessions

    result = get_sessions(limit=100, order="recent")
    return {"sessions": [{
        "id": row["id"], "title": row.get("title"), "source": row.get("source"),
        "status": "active" if row.get("is_active") else "ended",
        "last_activity": row.get("last_active"),
    } for row in result["sessions"]]}