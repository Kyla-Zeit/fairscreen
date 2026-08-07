# Setup Feature

M04 implements the setup form, media choices, validation, unsaved-change
preservation, and navigation to device review.

M05 adds deterministic local question generation and generated-question
snapshots.

M07.2 keeps resume input upload-only for PDF, DOCX, and TXT. Imported documents
are parsed by injected browser infrastructure, and only user-confirmed plain text
enters `resumeText`. Changing, replacing, or removing resume text clears stale
generated question snapshots.

M08.3 adds optional job posting URL, company website URL, job posting import, and
company research ports. The default browser services do not fetch remote pages.
Company research is consent-gated and excludes resume text, answers, recordings,
notes, transcripts, camera/microphone data, saved sessions, and local file paths
from the provider request.
