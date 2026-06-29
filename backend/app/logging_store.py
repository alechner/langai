import logging
from collections import deque
from datetime import datetime, timezone


_LOG_BUFFER_SIZE = 500
_log_records: deque[dict] = deque(maxlen=_LOG_BUFFER_SIZE)
_is_configured = False


class InMemoryLogHandler(logging.Handler):
    def emit(self, record: logging.LogRecord):
        _log_records.append(
            {
                "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
            }
        )


def setup_in_memory_logging():
    global _is_configured
    if _is_configured:
        return
    logging.getLogger().addHandler(InMemoryLogHandler())
    _is_configured = True


def get_recent_logs(limit: int = 100) -> list[dict]:
    safe_limit = max(1, min(limit, _LOG_BUFFER_SIZE))
    return list(_log_records)[-safe_limit:]
