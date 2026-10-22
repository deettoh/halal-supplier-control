"""Photo storage encoding preserves source files and useful image detail."""

import io

import pytest
from PIL import ExifTags, Image

from backend.images import as_jpeg


def image_bytes(
    mode: str = "RGB", size: tuple[int, int] = (1800, 900)
) -> bytes:
    output = io.BytesIO()
    color = (0, 0, 0, 0) if mode == "RGBA" else "white"
    Image.new(mode, size, color).save(output, format="PNG")
    return output.getvalue()


def test_png_is_stored_as_jpeg_without_reducing_resolution() -> None:
    source = image_bytes()
    stored = as_jpeg(source)
    assert source.startswith(b"\x89PNG\r\n\x1a\n")
    assert stored.startswith(b"\xff\xd8\xff")
    with Image.open(io.BytesIO(stored)) as photo:
        assert photo.format == "JPEG"
        assert photo.size == (1800, 900)
        assert photo.mode == "RGB"


def test_transparency_is_flattened_onto_white() -> None:
    with Image.open(io.BytesIO(as_jpeg(image_bytes("RGBA")))) as photo:
        assert photo.getpixel((0, 0)) == (255, 255, 255)


def test_jpeg_orientation_is_applied() -> None:
    exif = Image.Exif()
    exif[ExifTags.Base.Orientation] = 6
    output = io.BytesIO()
    Image.new("RGB", (40, 20), "white").save(output, format="JPEG", exif=exif)
    with Image.open(io.BytesIO(as_jpeg(output.getvalue()))) as photo:
        assert photo.format == "JPEG"
        assert photo.size == (20, 40)


@pytest.mark.parametrize(
    "payload", [b"", b"not a photo", b"\x89PNG\r\n\x1a\n"]
)
def test_corrupt_images_are_rejected(payload: bytes) -> None:
    with pytest.raises(ValueError, match="readable PNG or JPEG"):
        as_jpeg(payload)
