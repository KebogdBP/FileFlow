import re
import unicodedata
from urllib.parse import quote

INVALID_FILENAME_CHARACTERS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def converted_filename(
    source_filename: str, extension: str, *, source_is_filename: bool = True
) -> str:
    normalized_extension = extension if extension.startswith(".") else f".{extension}"
    leaf = source_filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    stem = leaf.rsplit(".", 1)[0] if source_is_filename and "." in leaf else leaf
    stem = INVALID_FILENAME_CHARACTERS.sub(" ", stem)
    stem = " ".join(stem.split()).strip(" .")
    if not stem:
        stem = "File"
    if stem.casefold().endswith(" converted"):
        stem = stem[: -len(" converted")].rstrip()
    available = max(1, 220 - len(" Converted") - len(normalized_extension))
    return f"{stem[:available].rstrip()} Converted{normalized_extension}"


def attachment_disposition(filename: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", filename).encode("ascii", "ignore").decode("ascii")
    ascii_name = INVALID_FILENAME_CHARACTERS.sub("_", ascii_name).strip(" .")
    if not ascii_name:
        ascii_name = "Converted"
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename, safe='')}"
