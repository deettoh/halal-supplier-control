# Startup seed data

The merged fictional dataset is at `src/seed/seed.json`: 2 suppliers,
4 certificates and 16 materials. Startup skips seeding if the file is absent.

The file format and image handling are documented in
[`docs/seed-format.md`](../../docs/seed-format.md).
Image files supplied using `image_file` must be inside this directory or its
subdirectories. Startup copies their bytes into PostgreSQL; these files are
initial seed assets, not storage for future uploads.
The current seed names future PNGs using `image_file`. Missing files are
skipped. Add the PNGs at those paths and restart/redeploy: startup fills
missing photos for matching existing seed certificates without overwriting
stored photos or other fields. PNG is the only supported seed image format;
no `image_content_type` field is needed.
