"""Pydantic schemas reflecting the shared CONTRACT.md data model."""

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Output models
# ---------------------------------------------------------------------------

class Challenge(BaseModel):
    id: int
    title: str
    description: str = ""
    # Personas que REALIZAN el reto (se les asigna un usuario con nombre).
    required_users: int
    # Personas TOTALES involucradas (realizan + participan). Opcional: si es
    # None solo se tiene en cuenta required_users para la elegibilidad.
    involved_users: int | None = None
    # Si es True la carta puede salir más de una vez en la misma sesión.
    repeatable: bool = False
    is_used: bool = False
    created_at: str


class User(BaseModel):
    id: int
    name: str
    color: str


class DrawResult(BaseModel):
    challenge: Challenge
    # Usuarios con nombre asignados (los que realizan el reto).
    assigned_users: list[User]
    # Participantes adicionales que quedan anónimos (involved - required).
    anonymous_count: int = 0
    remaining: int


class Stats(BaseModel):
    total: int
    used: int
    available: int
    users: int


class ResetResult(BaseModel):
    reset: int


class ImportResult(BaseModel):
    # Retos nuevos insertados y retos omitidos por estar ya en la BD (duplicados).
    imported: int
    skipped: int


class Health(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Input models (with validation per the contract)
# ---------------------------------------------------------------------------

class ChallengeCreate(BaseModel):
    title: str
    description: str = ""
    required_users: int = Field(..., ge=1)
    involved_users: int | None = Field(default=None, ge=1)
    repeatable: bool = False

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("title no puede estar vacío")
        return v.strip()

    @model_validator(mode="after")
    def involved_ge_required(self) -> "ChallengeCreate":
        if (
            self.involved_users is not None
            and self.involved_users < self.required_users
        ):
            raise ValueError(
                "involved_users no puede ser menor que required_users"
            )
        return self


class ImportRequest(BaseModel):
    # Refleja el formato del fichero exportado: una lista de retos. Cada reto se
    # valida igual que al crearlo (título no vacío, required_users >= 1, etc.).
    # Campos volátiles del export (id, is_used, created_at) se ignoran.
    challenges: list[ChallengeCreate]


class ChallengeUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    required_users: int | None = Field(default=None, ge=1)
    # involved_users es nullable de forma intencionada: enviar null lo limpia.
    # Para distinguir "no enviado" de "null" se usa model_fields_set en la ruta.
    involved_users: int | None = Field(default=None, ge=1)
    repeatable: bool | None = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not v.strip():
            raise ValueError("title no puede estar vacío")
        return v.strip()


class UserCreate(BaseModel):
    name: str
    color: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("name no puede estar vacío")
        return v.strip()


class DrawRequest(BaseModel):
    mode: str = "random"
    selected_user_ids: list[int] | None = None

    @field_validator("mode")
    @classmethod
    def valid_mode(cls, v: str) -> str:
        if v not in ("random", "selected"):
            raise ValueError("mode debe ser 'random' o 'selected'")
        return v
