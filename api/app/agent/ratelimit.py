import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException, status

from app.core.config import settings
from app.core.dependencies import get_current_user

_requests = defaultdict(deque)


def rate_limit_dependency(user=Depends(get_current_user)):
    now = time.monotonic()
    bucket = _requests[int(user.id)]
    while bucket and now - bucket[0] >= 60:
        bucket.popleft()
    if len(bucket) >= settings.agent_rate_limit_per_minute:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many assistant messages. Try again in a minute.",
        )
    bucket.append(now)
    return user
