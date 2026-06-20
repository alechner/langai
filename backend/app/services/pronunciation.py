from difflib import SequenceMatcher


def _tokenize(text: str) -> list[str]:
    return [token.strip(".,!?;:\"'()[]{}").lower() for token in text.split() if token.strip()]


def evaluate_pronunciation(target_sentence: str, transcript: str) -> dict:
    target_tokens = _tokenize(target_sentence)
    spoken_tokens = _tokenize(transcript)

    if not target_tokens:
        raise ValueError("Target sentence cannot be empty")

    matcher = SequenceMatcher(None, " ".join(target_tokens), " ".join(spoken_tokens))
    similarity_score = round(matcher.ratio() * 100, 2)

    matches = sum(1 for token in spoken_tokens if token in target_tokens)
    lexical_score = matches / max(len(target_tokens), len(spoken_tokens), 1)
    pronunciation_score = round(lexical_score * 100, 2)

    missing = [token for token in target_tokens if token not in spoken_tokens]
    extra = [token for token in spoken_tokens if token not in target_tokens]

    return {
        "similarity_score": similarity_score,
        "pronunciation_score": pronunciation_score,
        "missing_words": missing[:8],
        "extra_words": extra[:8],
        "target_tokens_count": len(target_tokens),
        "spoken_tokens_count": len(spoken_tokens),
    }
