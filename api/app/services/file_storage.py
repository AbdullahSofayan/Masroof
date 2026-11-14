"""File storage abstraction. Local disk today; swap the implementation for S3/MinIO later
without touching any route or other service - callers only ever see opaque `storage_key`s."""
from pathlib import Path

from fastapi import UploadFile


class FileStorageService:
    def __init__(self, base_dir: str) -> None:
        self.base_dir = Path(base_dir)

    def save(self, upload: UploadFile, expense_id: int) -> str:
        """Write the upload under a generated, unguessable name (never trust the client's filename).
        Return the `storage_key` to persist on the Attachment."""
        raise NotImplementedError

    def resolve_path(self, storage_key: str) -> Path:
        """Return the absolute path for a key. Must refuse keys that escape `base_dir` (path traversal)."""
        raise NotImplementedError

    def delete(self, storage_key: str) -> None:
        """Remove the stored file. Missing file is not an error."""
        raise NotImplementedError
