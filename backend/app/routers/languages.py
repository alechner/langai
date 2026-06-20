from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Language
from ..schemas import LanguageRead

router = APIRouter(prefix="/languages", tags=["languages"])


@router.get("", response_model=list[LanguageRead])
def list_languages(db: Session = Depends(get_db)):
    return db.query(Language).order_by(Language.name.asc()).all()
