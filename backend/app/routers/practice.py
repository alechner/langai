import tempfile
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import Language, SpeechAttempt, User
from ..schemas import PracticeEvaluateRequest, PracticeEvaluateResponse
from ..services.ollama_feedback import generate_feedback
from ..services.pronunciation import evaluate_pronunciation
from ..services.stt import transcribe_file

router = APIRouter(prefix="/practice", tags=["practice"])
logger = logging.getLogger(__name__)


def _assert_supported_language(db: Session, code: str):
    language = db.query(Language).filter(Language.code == code).first()
    if not language:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported language: {code}")


async def _save_attempt(
    db: Session,
    user: User,
    language_code: str,
    target_sentence: str,
    transcript: str,
) -> PracticeEvaluateResponse:
    analysis = evaluate_pronunciation(target_sentence, transcript)
    try:
        feedback = await generate_feedback(language_code, target_sentence, transcript, analysis)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    attempt = SpeechAttempt(
        user_id=user.id,
        language_code=language_code,
        target_sentence=target_sentence,
        transcript=transcript,
        similarity_score=analysis["similarity_score"],
        pronunciation_score=analysis["pronunciation_score"],
        feedback=feedback,
    )
    db.add(attempt)
    db.commit()

    return PracticeEvaluateResponse(
        transcript=transcript,
        similarity_score=analysis["similarity_score"],
        pronunciation_score=analysis["pronunciation_score"],
        feedback=feedback,
    )


@router.post("/evaluate", response_model=PracticeEvaluateResponse)
async def evaluate_text(
    payload: PracticeEvaluateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_supported_language(db, payload.language_code)
    logger.info("Text evaluation started for user_id=%s language=%s", current_user.id, payload.language_code)
    return await _save_attempt(
        db,
        current_user,
        payload.language_code,
        payload.target_sentence,
        payload.spoken_text,
    )


@router.post("/evaluate-audio", response_model=PracticeEvaluateResponse)
async def evaluate_audio(
    language_code: str = Form(...),
    target_sentence: str = Form(...),
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_supported_language(db, language_code)
    logger.info("Audio evaluation started for user_id=%s language=%s", current_user.id, language_code)
    suffix = Path(audio.filename or "audio.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
        temp_path = Path(temp_file.name)
        temp_file.write(await audio.read())
    try:
        transcript = transcribe_file(temp_path, language_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    finally:
        temp_path.unlink(missing_ok=True)

    return await _save_attempt(db, current_user, language_code, target_sentence, transcript)
