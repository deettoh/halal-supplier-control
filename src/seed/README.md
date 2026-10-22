# Startup seed data

The merged fictional dataset is at `src/seed/seed.json`: 2 suppliers,
4 certificates and 16 materials. Startup skips seeding if the file is absent.

The file format and image handling are documented in
[`docs/seed-format.md`](../../docs/seed-format.md).
Image files supplied using `image_file` must be inside this directory or its
subdirectories. Startup copies their bytes into PostgreSQL; these files are
initial seed assets, not storage for future uploads.
The current seed uses reference-only certificate image paths; their actual
image assets still need to be supplied before bytes can be loaded.
