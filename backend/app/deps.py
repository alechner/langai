from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .auth import decode_access_token
from .db import get_db
from .models import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    subject = decode_access_token(token)
    user = db.query(User).filter(User.id == int(subject)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found for token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
