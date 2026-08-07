# Domain boundary

M03 defines FairScreen's browser-independent models, validated value factories,
invariants, search/deletion primitives, and repository/provider ports.

- Domain modules do not import React, DOM, IndexedDB, `Blob`, or browser APIs.
- Stable TypeScript models are canonical; Zod is used only by infrastructure
  boundary adapters.
- Raw media, frame observations, interim recognition state, and unreviewed text
  are intentionally absent from persistence ports.
- Content analysis inputs have no dependency on video measurements.

User-facing persistence and settings controls begin in later milestones.
