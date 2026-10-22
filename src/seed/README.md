# Startup seed data

Place the agreed fictional dataset at `src/seed/seed.json`.
No seed data is supplied yet; startup skips seeding while this file is absent.

The proposed file format and image handling are documented in
[`docs/seed-format.md`](../../docs/seed-format.md).
Image files referenced by the seed must be inside this directory or its
subdirectories. Startup copies their bytes into PostgreSQL; these files are
initial seed assets, not storage for future uploads.
