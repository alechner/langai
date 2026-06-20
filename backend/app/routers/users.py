from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import SpeechAttempt, User
from ..schemas import ProgressSummary, UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/progress", response_model=ProgressSummary)
def get_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total_attempts, avg_similarity, avg_pronunciation = (
        db.query(
            func.count(SpeechAttempt.id),
            func.coalesce(func.avg(SpeechAttempt.similarity_score), 0.0),
            func.coalesce(func.avg(SpeechAttempt.pronunciation_score), 0.0),
        )
        .filter(SpeechAttempt.user_id == current_user.id)
        .one()
    )
    return ProgressSummary(
        total_attempts=total_attempts,
        avg_similarity_score=round(float(avg_similarity), 2),
        avg_pronunciation_score=round(float(avg_pronunciation), 2),
    )
