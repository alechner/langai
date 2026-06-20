from pathlib import Path

from faster_whisper import WhisperModel

from ..config import settings


_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(settings.whisper_model_size, device="cpu", compute_type="int8")
    return _model


def transcribe_file(audio_path: Path, language_code: str) -> str:
    model = _get_model()
    segments, _ = model.transcribe(str(audio_path), language=language_code, beam_size=5)
    transcript = " ".join(segment.text.strip() for segment in segments).strip()
    if not transcript:
        raise ValueError("No speech detected in audio")
    return transcript
