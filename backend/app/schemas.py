from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8, max_length=255)


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LanguageRead(BaseModel):
    code: str
    name: str

    model_config = {"from_attributes": True}


class PracticeEvaluateRequest(BaseModel):
    language_code: str = Field(min_length=2, max_length=12)
    target_sentence: str = Field(min_length=1, max_length=1000)
    spoken_text: str = Field(min_length=1, max_length=2000)


class PracticeEvaluateResponse(BaseModel):
    transcript: str
    similarity_score: float
    pronunciation_score: float
    feedback: str


class ProgressSummary(BaseModel):
    total_attempts: int
    avg_similarity_score: float
    avg_pronunciation_score: float
