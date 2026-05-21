"""MinIO object storage wrapper used for docs, chat attachments, and generated images."""
from __future__ import annotations

import io
from datetime import timedelta
from functools import lru_cache
from urllib.parse import urlparse

from minio import Minio
from minio.error import S3Error

from ..core.config import get_settings


@lru_cache
def _client() -> Minio:
    s = get_settings()
    return Minio(
        s.minio_endpoint,
        access_key=s.minio_root_user,
        secret_key=s.minio_root_password,
        secure=s.minio_use_ssl,
    )


@lru_cache
def _presign_client() -> Minio:
    """Separate client whose endpoint matches the browser-reachable host so the
    sigv4 signature is computed against the public host. Presigning is a local
    operation (no network call), so this client doesn't need to actually connect.
    """
    s = get_settings()
    parsed = urlparse(s.minio_public_endpoint or f"http://{s.minio_endpoint}")
    host = parsed.netloc or parsed.path
    secure = (parsed.scheme == "https") if parsed.scheme else s.minio_use_ssl
    return Minio(
        host,
        access_key=s.minio_root_user,
        secret_key=s.minio_root_password,
        secure=secure,
        region="us-east-1",
    )


def _all_buckets() -> list[str]:
    s = get_settings()
    return [s.minio_bucket_docs, s.minio_bucket_attachments, s.minio_bucket_images]


def ensure_buckets() -> None:
    client = _client()
    for bucket in _all_buckets():
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)


def put_object(bucket: str, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    client = _client()
    client.put_object(
        bucket,
        key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    return key


def get_object(bucket: str, key: str) -> bytes:
    client = _client()
    resp = client.get_object(bucket, key)
    try:
        return resp.read()
    finally:
        resp.close()
        resp.release_conn()


def object_exists(bucket: str, key: str) -> bool:
    client = _client()
    try:
        client.stat_object(bucket, key)
        return True
    except S3Error:
        return False


def delete_object(bucket: str, key: str) -> None:
    _client().remove_object(bucket, key)


def presigned_url(bucket: str, key: str, expiry: int | None = None) -> str:
    s = get_settings()
    seconds = expiry if expiry is not None else s.minio_presign_expiry
    return _presign_client().presigned_get_object(bucket, key, expires=timedelta(seconds=seconds))
