from fastapi import APIRouter, Depends, Query

from ..deps import get_admin_user
from ..models import User
from ..logging_store import get_recent_logs
from ..schemas import AppLogEntry

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/logs", response_model=list[AppLogEntry])
def list_application_logs(
    limit: int = Query(default=100, ge=1, le=500),
    _admin_user: User = Depends(get_admin_user),
):
    return get_recent_logs(limit=limit)
