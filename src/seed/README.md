# Startup seed data

The merged fictional dataset is at `src/seed/seed.json`: 2 suppliers,
4 certificates and 16 materials. Startup skips seeding if the file is absent.

The file format and image handling are documented in
[`docs/seed-format.md`](../../docs/seed-format.md).
Image files supplied using `image_file` must be inside this directory or its
subdirectories. Startup converts them to JPEG bytes in PostgreSQL; PNG files
remain unchanged in the repo. These files are
initial seed assets, not storage for future uploads.
The current seed names four committed demo PNGs using `image_file`. Missing
files are skipped. On restart/redeploy, startup fills
missing photos for matching existing seed certificates without overwriting
stored photos with different seed content. Seed source files use PNG;
both certificate and delivery bytes in PostgreSQL use JPEG. Legacy stored
PNGs are converted at startup; existing JPEGs are not re-encoded.
No `image_content_type` field is needed.
