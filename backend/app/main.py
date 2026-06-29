from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .config import settings
from .db import Base, SessionLocal, engine
from .logging_store import setup_in_memory_logging
from .models import Language, User
from .routers import admin, auth, languages, practice, users

app = FastAPI(title=settings.app_name, debug=settings.debug)
setup_in_memory_logging()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def seed_languages(db: Session):
    defaults = [
        ("en", "English"),
        ("pt", "Portuguese"),
        ("es", "Spanish"),
        ("fr", "French"),
    ]
    for code, name in defaults:
        if not db.query(Language).filter(Language.code == code).first():
            db.add(Language(code=code, name=name))
    db.commit()


def ensure_users_admin_column():
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "is_admin" in user_columns:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE"))


def ensure_speech_attempts_audio_column():
    inspector = inspect(engine)
    if "speech_attempts" not in inspector.get_table_names():
        return
    attempt_columns = {column["name"] for column in inspector.get_columns("speech_attempts")}
    if "audio_base64" in attempt_columns:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE speech_attempts ADD COLUMN audio_base64 TEXT DEFAULT NULL"))


def ensure_at_least_one_admin(db: Session):
    admin_count = db.query(User).filter(User.is_admin.is_(True)).count()
    if admin_count > 0:
        return
    first_user = db.query(User).order_by(User.created_at.asc()).first()
    if first_user:
        first_user.is_admin = True
        db.commit()


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    ensure_users_admin_column()
    ensure_speech_attempts_audio_column()
    db = SessionLocal()
    try:
        seed_languages(db)
        ensure_at_least_one_admin(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(languages.router, prefix="/api/v1")
app.include_router(practice.router, prefix="/api/v1")
