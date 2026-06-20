from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .config import settings
from .db import Base, SessionLocal, engine
from .models import Language
from .routers import auth, languages, practice, users

app = FastAPI(title=settings.app_name, debug=settings.debug)

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


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_languages(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(languages.router, prefix="/api/v1")
app.include_router(practice.router, prefix="/api/v1")
