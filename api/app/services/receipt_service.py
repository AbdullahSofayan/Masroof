from io import BytesIO
from os import getenv
from pathlib import Path
from uuid import uuid4
from warnings import catch_warnings, simplefilter

from fastapi import HTTPException, UploadFile


# receipt files are stored outside the frontend and served by the API
receipt_directory = Path(getenv("MASROOF_RECEIPT_DIR") or (Path.home() / ".masroof" / "receipts"))
max_receipt_size = 5 * 1024 * 1024
receipt_types = {
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".pdf": "application/pdf",
}


# check the file size and make sure the contents match the extension
def read_receipt_upload(upload: UploadFile):
    extension = Path(upload.filename or "").suffix.lower()
    if extension == ".jpeg":
        extension = ".jpg"
    if extension not in receipt_types:
        raise HTTPException(status_code=415, detail="Use a JPG, PNG, or PDF receipt.")

    content = upload.file.read(max_receipt_size + 1)
    if not content:
        raise HTTPException(status_code=422, detail="The receipt is empty.")
    if len(content) > max_receipt_size:
        raise HTTPException(status_code=413, detail="The receipt must be 5 MB or smaller.")

    try:
        from PIL import Image, UnidentifiedImageError
        from pypdf import PdfReader
        from pypdf.errors import PyPdfError
    except ImportError as error:
        raise HTTPException(status_code=503, detail="Receipt validation is unavailable.") from error

    try:
        if extension == ".pdf":
            if not content.startswith(b"%PDF-"):
                raise ValueError("Invalid PDF header.")
            pdf = PdfReader(BytesIO(content))
            if pdf.is_encrypted or not pdf.pages:
                raise ValueError("The PDF must contain a readable page.")
        else:
            with catch_warnings():
                simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(content)) as image:
                    expected_format = "JPEG" if extension == ".jpg" else "PNG"
                    if image.format != expected_format:
                        raise ValueError("Image format does not match the extension.")
                    image.verify()
    except (
        PyPdfError, UnidentifiedImageError, OSError, ValueError, SyntaxError,
        Image.DecompressionBombError, Image.DecompressionBombWarning, RecursionError,
    ) as error:
        raise HTTPException(status_code=415, detail="The receipt file is not valid.") from error

    return content, extension


# generate the stored filename on the server
def save_receipt(content: bytes, extension: str) -> str:
    receipt_directory.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    path = receipt_directory / filename
    with path.open("xb") as file:
        file.write(content)
    return filename


# make sure the stored path stays inside the receipt directory
def receipt_file(filename: str) -> Path:
    path = (receipt_directory / filename).resolve()
    if path.parent != receipt_directory.resolve() or path.suffix not in receipt_types:
        raise HTTPException(status_code=404, detail="Receipt not found.")
    return path
