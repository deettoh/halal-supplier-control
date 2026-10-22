"""JPEG storage encoding; certificate source assets remain PNG files."""

import io
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError

JPEG_QUALITY = 85


def as_jpeg(payload: bytes) -> bytes:
    """Decode PNG/JPEG, orient upright and flatten onto white at full size."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(payload)) as photo:
                if photo.format not in {"PNG", "JPEG"}:
                    raise ValueError("Unsupported image format")
                upright = ImageOps.exif_transpose(photo).convert("RGBA")
                rgb = Image.new("RGB", upright.size, "white")
                rgb.paste(upright, mask=upright.getchannel("A"))
                output = io.BytesIO()
                rgb.save(
                    output, format="JPEG", quality=JPEG_QUALITY, optimize=True
                )
                return output.getvalue()
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise ValueError(
            "Photo must be a readable PNG or JPEG image"
        ) from None
