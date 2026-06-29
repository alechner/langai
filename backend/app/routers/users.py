from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_admin_user, get_current_user
from ..models import SpeechAttempt, User
from ..schemas import ProgressSummary, UserAdminUpdate, UserRead

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


@router.get("/admin", response_model=list[UserRead])
def list_users_admin(
    db: Session = Depends(get_db),
    _admin_user: User = Depends(get_admin_user),
):
    return db.query(User).order_by(User.created_at.asc()).all()


@router.patch("/admin/{user_id}", response_model=UserRead)
def update_user_admin(
    payload: UserAdminUpdate,
    user_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.full_name is not None:
        user.full_name = payload.full_name

    if payload.is_admin is not None:
        if user.id == admin_user.id and not payload.is_admin:
            raise HTTPException(status_code=400, detail="You cannot remove your own admin access")
        if user.is_admin and not payload.is_admin:
            admin_count = db.query(func.count(User.id)).filter(User.is_admin.is_(True)).scalar() or 0
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="At least one admin user is required")
        user.is_admin = payload.is_admin

    db.commit()
    db.refresh(user)
    return user
