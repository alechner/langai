import json

import httpx

from ..config import settings


async def generate_feedback(
    language_code: str,
    target_sentence: str,
    transcript: str,
    analysis: dict,
) -> str:
    prompt = (
        "You are an encouraging pronunciation coach.\n"
        f"Practice language code: {language_code}\n"
        f"Target sentence: {target_sentence}\n"
        f"Learner transcript: {transcript}\n"
        f"Scoring details: {json.dumps(analysis, ensure_ascii=True)}\n"
        "Return concise feedback in 3 parts: what was good, what to improve, and one next attempt tip."
    )
    payload = {"model": settings.ollama_model, "prompt": prompt, "stream": False}
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(f"{settings.ollama_url}/api/generate", json=payload)
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Could not connect to Ollama at {settings.ollama_url}") from exc
    if response.status_code != 200:
        raise RuntimeError(f"Ollama request failed with {response.status_code}: {response.text}")
    data = response.json()
    feedback = data.get("response", "").strip()
    if not feedback:
        raise RuntimeError("Ollama returned empty feedback")
    return feedback
