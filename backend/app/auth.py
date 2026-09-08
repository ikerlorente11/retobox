"""Authentication helpers: password hashing, opaque cookie sessions, Google
ID-token verification and the FastAPI dependencies that resolve *who* is
calling (a logged-in account, an anonymous guest, or nobody).

Identity resolution (``resolve_owner``):

1. A valid ``retobox_session`` cookie -> account, owner_key ``u:<id>``.
2. Otherwise an ``X-Guest-Key`` header (browser-generated) -> ``g:<key>``.
3. Otherwise no identity (only public read endpoints work).
"""

import hashlib
import os
import re
import secrets
import sqlite3
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, Header, HTTPException, Request, Response

from app.database import _lock, account_row_to_dict, get_connection

SESSION_COOKIE = "retobox_session"
SESSION_DAYS = 30
# Secure flag must be on behind HTTPS in production; off for plain-http dev.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "").lower() in ("1", "true", "yes", "on")
# Google OAuth Client ID (public). Empty -> Google login disabled.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip() or None
# Lower cost in tests; production keeps bcrypt's default-ish cost.
BCRYPT_ROUNDS = int(os.environ.get("BCRYPT_ROUNDS", "12"))
# bcrypt only hashes the first 72 bytes; longer passwords are rejected up front.
PASSWORD_MAX_BYTES = 72
# Behind our nginx the real client address arrives in X-Real-IP. Only trust it
# when explicitly enabled; otherwise a client could spoof it to dodge the throttle.
TRUST_PROXY = os.environ.get("TRUST_PROXY", "").lower() in ("1", "true", "yes", "on")

GUEST_KEY_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
SESSION_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{32,64}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Brute-force throttle for login: attempts per (client ip, email) in a window.
LOGIN_MAX_ATTEMPTS = 10
LOGIN_WINDOW_SECONDS = 15 * 60
# Hard cap on tracked keys so unauthenticated traffic cannot grow memory forever.
LOGIN_TRACKED_MAX = 10_000
_login_attempts: dict[tuple[str, str], list[float]] = {}
_attempts_lock = threading.Lock()


@dataclass(frozen=True)
class Owner:
    """Who owns the per-player state of the current request."""

    key: str
    account: dict | None  # None for guests

    @property
    def account_id(self) -> int | None:
        return self.account["id"] if self.account else None


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    ).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except ValueError:
        return False


def validate_password(password: str) -> str:
    if len(password.encode("utf-8")) > PASSWORD_MAX_BYTES:
        raise HTTPException(
            status_code=422, detail="La contraseña es demasiado larga (máx. 72 bytes)."
        )
    return password


def client_ip(request: Request) -> str:
    if TRUST_PROXY:
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
    return request.client.host if request.client else "unknown"


def normalize_email(email: str) -> str:
    email = email.strip().lower()
    if not EMAIL_RE.match(email) or len(email) > 254:
        raise HTTPException(status_code=422, detail="Email no válido.")
    return email


# ---------------------------------------------------------------------------
# Login throttling
# ---------------------------------------------------------------------------

def check_login_throttle(client_ip: str, email: str) -> None:
    now = time.monotonic()
    key = (client_ip, email)
    with _attempts_lock:
        attempts = [t for t in _login_attempts.get(key, []) if now - t < LOGIN_WINDOW_SECONDS]
        _login_attempts[key] = attempts
        if len(attempts) >= LOGIN_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=429,
                detail="Demasiados intentos. Espera unos minutos.",
            )


def _prune_attempts(now: float) -> None:
    """Drop keys whose attempts all fell out of the window. Caller holds the lock."""
    stale = [
        key
        for key, times in _login_attempts.items()
        if not times or now - times[-1] >= LOGIN_WINDOW_SECONDS
    ]
    for key in stale:
        del _login_attempts[key]


def record_login_failure(client_ip: str, email: str) -> None:
    now = time.monotonic()
    with _attempts_lock:
        _prune_attempts(now)
        if len(_login_attempts) >= LOGIN_TRACKED_MAX:
            # Still full after pruning: forget the oldest key rather than grow.
            oldest = min(_login_attempts, key=lambda k: _login_attempts[k][-1])
            del _login_attempts[oldest]
        _login_attempts.setdefault((client_ip, email), []).append(now)


def clear_login_failures(client_ip: str, email: str) -> None:
    with _attempts_lock:
        _login_attempts.pop((client_ip, email), None)


# ---------------------------------------------------------------------------
# Sessions (opaque token in an httpOnly cookie; DB stores only its hash)
# ---------------------------------------------------------------------------

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(conn: sqlite3.Connection, account_id: int) -> str:
    """Insert a session row and return the raw token. Caller holds ``_lock``."""
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    conn.execute(
        "INSERT INTO sessions (token_hash, account_id, created_at, expires_at) "
        "VALUES (?, ?, ?, ?)",
        (
            _hash_token(token),
            account_id,
            now.isoformat(),
            (now + timedelta(days=SESSION_DAYS)).isoformat(),
        ),
    )
    conn.execute(
        "DELETE FROM sessions WHERE expires_at < ?", (now.isoformat(),)
    )
    return token


def delete_session(conn: sqlite3.Connection, token: str) -> None:
    conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(token),))


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_DAYS * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        path="/api",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/api")


def _account_from_session(conn: sqlite3.Connection, token: str) -> dict | None:
    now = datetime.now(timezone.utc).isoformat()
    row = conn.execute(
        "SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id "
        "WHERE s.token_hash = ? AND s.expires_at > ?",
        (_hash_token(token), now),
    ).fetchone()
    return account_row_to_dict(row) if row else None


# ---------------------------------------------------------------------------
# Google Sign-In (ID token from Google Identity Services)
# ---------------------------------------------------------------------------

def verify_google_token(credential: str) -> dict:
    """Verify a Google ID token and return ``{sub, email, name}``.

    Raises HTTPException(400) when Google login is not configured or the token
    is invalid. Imported lazily so the dependency is only needed when used.
    """
    if GOOGLE_CLIENT_ID is None:
        raise HTTPException(status_code=400, detail="Google login no está configurado.")
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    try:
        info = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Token de Google no válido.")
    if not info.get("email") or not info.get("email_verified", False):
        raise HTTPException(status_code=401, detail="Token de Google no válido.")
    return {
        "sub": info["sub"],
        "email": info["email"],
        "name": info.get("name") or info["email"].split("@")[0],
    }


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

def guest_owner_key(guest_key: str | None) -> str | None:
    if guest_key is None:
        return None
    if not GUEST_KEY_RE.match(guest_key):
        raise HTTPException(status_code=400, detail="X-Guest-Key no válido.")
    return f"g:{guest_key}"


def account_owner_key(account_id: int) -> str:
    return f"u:{account_id}"


def resolve_owner(
    request: Request,
    x_guest_key: str | None = Header(default=None, alias="X-Guest-Key"),
) -> Owner | None:
    """Optional identity: account (cookie) > guest (header) > None."""
    token = request.cookies.get(SESSION_COOKIE)
    if token and SESSION_TOKEN_RE.match(token):
        conn = get_connection()
        with _lock:
            account = _account_from_session(conn, token)
        if account is not None:
            return Owner(key=account_owner_key(account["id"]), account=account)
    guest = guest_owner_key(x_guest_key)
    if guest is not None:
        return Owner(key=guest, account=None)
    return None


def require_owner(owner: Owner | None = Depends(resolve_owner)) -> Owner:
    """Endpoints with per-player state need at least a guest identity."""
    if owner is None:
        raise HTTPException(
            status_code=400,
            detail="Falta la identidad (cookie de sesión o X-Guest-Key).",
        )
    return owner


def require_account(owner: Owner | None = Depends(resolve_owner)) -> Owner:
    """Endpoints that create or modify collections need a logged-in account."""
    if owner is None or owner.account is None:
        raise HTTPException(
            status_code=401,
            detail="Inicia sesión para hacer esto.",
        )
    return owner


# ---------------------------------------------------------------------------
# Guest -> account merge (on login / register)
# ---------------------------------------------------------------------------

def merge_guest_into_account(
    conn: sqlite3.Connection, guest_key: str | None, account_id: int
) -> None:
    """Move a guest's players, word groups and draw state to the account.

    Draw counts that exist on both sides keep the larger value. Caller holds
    ``_lock``; commit is left to the caller.
    """
    if guest_key is None:
        return
    target = account_owner_key(account_id)
    conn.execute(
        "UPDATE users SET owner_key = ? WHERE owner_key = ?", (target, guest_key)
    )
    conn.execute(
        "UPDATE word_groups SET owner_key = ? WHERE owner_key = ?", (target, guest_key)
    )
    conn.execute(
        "INSERT INTO draw_state (owner_key, challenge_id, draw_count) "
        "SELECT ?, challenge_id, draw_count FROM draw_state WHERE owner_key = ? "
        "ON CONFLICT(owner_key, challenge_id) DO UPDATE SET "
        "draw_count = MAX(draw_state.draw_count, excluded.draw_count)",
        (target, guest_key),
    )
    conn.execute("DELETE FROM draw_state WHERE owner_key = ?", (guest_key,))
