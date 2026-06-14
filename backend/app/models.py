"""Pydantic schemas reflecting the shared CONTRACT.md data model."""

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Output models
# ---------------------------------------------------------------------------

class Challenge(BaseModel):
    id: int
    title: str
    description: str = ""
    required_users: int
    is_used: bool = False
    created_at: str


class User(BaseModel):
    id: int
    name: str
    color: str


class DrawResult(BaseModel):
    challenge: Challenge
    assigned_users: list[User]
    remaining: int


class Stats(BaseModel):
    total: int
    used: int
    available: int
    users: int


class ResetResult(BaseModel):
    reset: int


class Health(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Input models (with validation per the contract)
# ---------------------------------------------------------------------------

class ChallengeCreate(BaseModel):
    title: str
    description: str = ""
    required_users: int = Field(..., ge=1)

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("title no puede estar vacío")
        return v.strip()


class ChallengeUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    required_users: int | None = Field(default=None, ge=1)

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
