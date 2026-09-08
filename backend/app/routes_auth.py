"""Auth routes: register / login (email + password), Google Sign-In, logout,
current account and public auth config. All under ``/api/auth``.

On register/login/google, a guest's data (``X-Guest-Key``) is merged into the
account so nothing created before signing in is lost.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response

from app.auth import (
    GOOGLE_CLIENT_ID,
    SESSION_COOKIE,
    Owner,
    check_login_throttle,
    clear_login_failures,
    clear_session_cookie,
    client_ip,
    create_session,
    delete_session,
    guest_owner_key,
    hash_password,
    merge_guest_into_account,
    normalize_email,
    record_login_failure,
    require_account,
    set_session_cookie,
    validate_password,
    verify_google_token,
    verify_password,
)
from app.database import _lock, account_row_to_dict, get_connection, write_transaction
from app.models import (
    Account,
    AuthConfig,
    GoogleLoginRequest,
    LoginRequest,
    RegisterRequest,
)

router = APIRouter(prefix="/api/auth")

# Nombre de la colección que se crea automáticamente con cada cuenta nueva,
# para que el usuario tenga dónde guardar retos desde el primer momento.
FIRST_COLLECTION_NAME = "Mis retos"


def _create_first_collection(conn, account_id: int, now: str) -> None:
    conn.execute(
        "INSERT INTO collections (name, owner_id, created_at) VALUES (?, ?, ?)",
        (FIRST_COLLECTION_NAME, account_id, now),
    )


def _login_response(conn, response: Response, account_id: int, guest_key: str | None) -> Account:
    """Merge guest data, open a session and set the cookie. Caller holds ``_lock``."""
    merge_guest_into_account(conn, guest_key, account_id)
    token = create_session(conn, account_id)
    conn.commit()
    set_session_cookie(response, token)
    row = conn.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
    return Account(**account_row_to_dict(row))


@router.get("/config", response_model=AuthConfig)
def auth_config() -> AuthConfig:
    return AuthConfig(google_client_id=GOOGLE_CLIENT_ID)


@router.get("/me", response_model=Account)
def me(owner: Owner = Depends(require_account)) -> Account:
    return Account(**owner.account)


@router.post("/register", response_model=Account, status_code=201)
def register(
    payload: RegisterRequest,
    response: Response,
    x_guest_key: str | None = Header(default=None, alias="X-Guest-Key"),
) -> Account:
    email = normalize_email(payload.email)
    validate_password(payload.password)
    name = payload.name or email.split("@")[0]
    guest_key = guest_owner_key(x_guest_key)
    now = datetime.now(timezone.utc).isoformat()
    with write_transaction() as conn:
        if conn.execute("SELECT 1 FROM accounts WHERE email = ?", (email,)).fetchone():
            raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese email.")
        cur = conn.execute(
            "INSERT INTO accounts (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (email, name, hash_password(payload.password), now),
        )
        account_id = cur.lastrowid
        _create_first_collection(conn, account_id, now)
        return _login_response(conn, response, account_id, guest_key)


@router.post("/login", response_model=Account)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    x_guest_key: str | None = Header(default=None, alias="X-Guest-Key"),
) -> Account:
    email = normalize_email(payload.email)
    ip = client_ip(request)
    check_login_throttle(ip, email)
    guest_key = guest_owner_key(x_guest_key)
    with write_transaction() as conn:
        row = conn.execute("SELECT * FROM accounts WHERE email = ?", (email,)).fetchone()
        ok = (
            row is not None
            and row["password_hash"] is not None
            and verify_password(payload.password, row["password_hash"])
        )
        if not ok:
            record_login_failure(ip, email)
            raise HTTPException(status_code=401, detail="Email o contraseña incorrectos.")
        clear_login_failures(ip, email)
        return _login_response(conn, response, row["id"], guest_key)


@router.post("/google", response_model=Account)
def google_login(
    payload: GoogleLoginRequest,
    response: Response,
    x_guest_key: str | None = Header(default=None, alias="X-Guest-Key"),
) -> Account:
    info = verify_google_token(payload.credential)
    email = normalize_email(info["email"])
    guest_key = guest_owner_key(x_guest_key)
    now = datetime.now(timezone.utc).isoformat()
    with write_transaction() as conn:
        row = conn.execute(
            "SELECT * FROM accounts WHERE google_sub = ?", (info["sub"],)
        ).fetchone()
        if row is None:
            # Misma dirección registrada con contraseña -> se enlaza Google.
            row = conn.execute("SELECT * FROM accounts WHERE email = ?", (email,)).fetchone()
            if row is not None:
                conn.execute(
                    "UPDATE accounts SET google_sub = ? WHERE id = ?", (info["sub"], row["id"])
                )
                account_id = row["id"]
            else:
                cur = conn.execute(
                    "INSERT INTO accounts (email, name, google_sub, created_at) "
                    "VALUES (?, ?, ?, ?)",
                    (email, info["name"][:80], info["sub"], now),
                )
                account_id = cur.lastrowid
                _create_first_collection(conn, account_id, now)
        else:
            account_id = row["id"]
        return _login_response(conn, response, account_id, guest_key)


@router.post("/logout", status_code=204)
def logout(request: Request) -> Response:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        conn = get_connection()
        with _lock:
            delete_session(conn, token)
            conn.commit()
    response = Response(status_code=204)
    clear_session_cookie(response)
    return response
