"""Image serving endpoint.

Generated images are stored permanently in MinIO by their SHA-256 key.
The presigned URL saved in message content expires (default 1 h), so after
a Docker restart or after the TTL elapses the browser cannot load the image.

This endpoint accepts the permanent object key and issues a 302 redirect to a
freshly-generated presigned URL, making images durable across restarts.

Auth: accepts the JWT either as the standard Authorization: Bearer header *or*
as a ``?token=`` query parameter, because browser <img> tags cannot send custom
headers.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..services import storage
from ..core.config import get_settings
from ..core.security import decode_token
from ..db.session import get_db
from ..models import User

router = APIRouter(prefix="/api/images", tags=["images"])


@router.get("/{key:path}")
def serve_image(
    key: str,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Return a redirect to a fresh presigned URL for the given image key.

    Accepts auth via:
    - ``Authorization: Bearer <token>`` header (standard API calls)
    - ``?token=<token>`` query parameter (browser ``<img>`` tags)
    """
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.scalar(select(User).where(User.id == user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    bucket = get_settings().minio_bucket_images
    if not storage.object_exists(bucket, key):
        raise HTTPException(status_code=404, detail="Image not found")
    url = storage.presigned_url(bucket, key)
    return RedirectResponse(url=url, status_code=302)
