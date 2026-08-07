# FairScreen

FairScreen is a static, local-first interview-practice application.

## Specification

The FairScreen specification package is in `docs/spec/`, with M07.2 and M08
addenda applied to the PRD, UX, measurement, architecture, privacy, QA, and
decision-log documents.

- Specification version: `1.0`
- Primary implementation guide:
  `docs/spec/10_FairScreen_Codex_Handoff.md`
- Current completed milestone:
  `M11 reports, saved sessions, notes, deletion, and export`
- Application version: `0.11.10`

The current build focuses on the complete interview-practice, reporting, and saved-session workflow. The former Fairness Lab page has been removed.

## Runtime

- Node: `24.15.0`
- npm: `11.12.1`
- Package manager pin: `npm@11.12.1`

Use the pinned versions in `.nvmrc` and `package.json`.

## Setup

```sh
npm ci
npm run check
npm run browser
```

Install Playwright's pinned Chromium build once when a machine does not already
have it:

```sh
npx playwright install chromium
```

For local development:

```sh
npm run dev -- --port 5173
```

For a production preview under the non-root base path:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173/fairscreen/`.

## Scripts

- `npm run format`: format files with Prettier.
- `npm run format:check`: check formatting.
- `npm run lint`: run strict TypeScript and accessibility linting.
- `npm run typecheck`: run all strict TypeScript projects.
- `npm run test`: run unit, component, schema, migration, and repository tests.
- `npm run browser`: build and run Playwright/axe against the production
  preview.
- `npm run build`: create the static production bundle.
- `npm run scan:language`: reject prohibited product-language patterns outside
  reviewed documentation.
- `npm run scan:secrets`: reject secret-shaped client configuration and token
  patterns.
- `npm run audit:deps`: verify pinned dependencies and local-only runtime
  boundaries.
- `npm run check`: run the non-browser quality gate.

## Implemented through M10

### M01 — Foundation

- Vite, React, strict TypeScript, Tailwind CSS, `HashRouter`, Zod, Vitest,
  Testing Library, Playwright, axe, ESLint, and Prettier.
- Semantic responsive app shell, skip link, route-heading focus, route error
  boundary, and global resource registry.
- Design tokens for contrast, focus, reduced motion, forced colours, print, and
  320 CSS px reflow.
- Secret, dependency, language, network, accessibility, type, lint, format, and
  build gates.

### M02 — Public experience

- Complete Home, Privacy, Methodology, Accessibility, and Saved Sessions pages.
- Responsive desktop/mobile navigation, disclosures, comparison tables, empty
  states, and clear local-first/privacy boundaries.
- Every sitemap route has a unique title, heading, active navigation state, and
  non-root hash-route support.
- Browser coverage for keyboard focus/history, skip link, menu escape/focus,
  320 px reflow, reduced motion, forced colours, print, no external requests,
  and no browser capability calls on route load.

### M03 — Local data

- Canonical browser-independent domain models, branded value factories,
  invariants, injected clock/ID/random ports, safe query/filter primitives, and
  export filenames.
- Strict Zod schemas for persistence, export, configuration, and worker-result
  boundaries; optional fields are normalized into canonical omitted form.
- Serialization guards reject raw frames, pixels, landmarks, matrices,
  embeddings, PCM/typed arrays, interim recognition state, unreviewed
  transcripts, binary values outside the recording adapter, and content/video
  coupling.
- Native IndexedDB schema version 2 with an automatic repair migration for older local databases,
  required stores/indexes, atomic writes, metadata, corrupt-record quarantine,
  and unsupported-future-version read-only recovery.
- Matching in-memory ephemeral repository behind the same domain port.
- Scoped cascade plans for recording, response, fairness trial, comparison,
  session, demo, and all-data deletion. Settings inclusion is explicit and
  settings reset remains a separate operation.
- Immutable settings defaults/session snapshots, approximate Storage API
  estimates, deterministic namespaced four-condition demo records, and
  demo-only removal.
- Recording `Blob` access remains in an infrastructure-only repository and
  requires an explicit post-review save call.

### M04 - Setup and device check

- Complete setup form for role context, category, difficulty, question count,
  timing mode, live coaching, transcription preference, optional camera and
  microphone choices, optional recording capture, and custom-question drafts.
- Setup validation covers required job title, field limits, question count,
  preparation time, answer time, and incompatible recording choices. Error
  summary receives focus and valid input survives navigation to device review
  and back.
- Browser capability report covers secure context, media devices, device
  enumeration, Web Audio, MediaRecorder, MIME candidates, Worker, WebAssembly,
  local video-condition availability, speech recognition, IndexedDB, storage
  estimate, print, and blob download without requesting camera or microphone
  permission.
- Camera and microphone permission requests are separate, user-triggered, and
  never run on route load or support re-check. Denial, unavailable, and pending
  states preserve setup input and offer camera-only, microphone-only, or neither
  paths.
- Device check includes default device selectors before labels are available,
  selector refresh after permission, camera preview, display-only mirror toggle,
  hide/show preview, accessible microphone meter text, pending permission copy,
  global Stop, and limited/ephemeral mode messaging.
- Browser media, capability, and audio-level access stays inside
  `src/infrastructure/browser`; pages consume injected services and fakes.
- Active streams and microphone monitor resources are registered in the global
  resource registry and cleaned up on replacement, route leave, pagehide, stop,
  error cleanup, and test teardown.

### M05 - Deterministic question provider

- Local-only `QuestionProvider` implementation with 60 reviewed built-in
  templates across general behavioural, software/technical, customer service,
  leadership, and investigative banks.
- Deterministic Unicode-normalized prompt duplicate detection, role-term
  extraction, stop-word and sensitive-token filtering, source/weight metadata,
  and seeded selection based on the session ID and setup context.
- Documented fallback order through selected bank, adjacent difficulty, general
  behavioural, and five role-neutral recovery questions.
- Custom question add/edit/remove/reorder flow with duplicate validation and
  final generated question snapshots.
- Setup page depends on the provider port and can use a fake provider in tests.
- Algorithm version: `local-question-provider-v1`; keyword extractor version:
  `keyword-extractor-v1`.

### M06 - Interview workflow and state machine

- Pure reducer with exactly `ready`, `preparing`, `answering`, `reviewing`,
  `betweenQuestions`, and `complete` states.
- Approved state transitions with privacy-safe invalid-event diagnostics and
  duplicate activation protection.
- Timestamp-derived flexible, strict-practice, and untimed timing modes.
  Flexible mode never hard-stops an answer; strict-practice mode expires only
  after explicit opt-in and supports one extension action.
- Sparse timer announcements at state start, 30 seconds, 10 seconds, expiry,
  and overtime where applicable, with a setting to silence timer thresholds.
- State-appropriate Start, Finish, Repeat, Skip, End, Extend Time, preview
  visibility, Exit, and global Stop controls.
- Confirmation before discarding active preparation, answering, or review work.
- Separate timestamped retry attempts with explicit user selection for report
  display. FairScreen does not choose an attempt automatically.
- Safe progress checkpoints and repository projection through the M03
  `FairScreenRepository` port. Reload recovery returns to non-capturing safe
  states and does not restart timers, camera, microphone, recorder, or other
  devices.
- Manual transcript entry remains available as private practice input. M09 and M10
  add reviewed transcript handling and deterministic practice coaching without
  changing the six-state M06 workflow. Hiring scores and automated selection
  recommendations remain excluded.
- Browser and component coverage for keyboard-only completion, 320 px reflow,
  axe scans, no automatic media/storage/capability API calls on route load, and
  M04 resource-registry Stop compatibility.

### M07 - Audio measurement and recording

- User-triggered microphone capture during answering, using the existing M04
  media service and global resource registry.
- Local Web Audio aggregation for approved setup/signal metrics only: speaking
  duration, first detected speech delay, longest internal silence, average
  microphone level, peak microphone level, sample count, interruption status,
  and explicit unavailable/limited states.
- Optional MediaRecorder capture with ordered MIME fallback, runtime error and
  zero-byte handling, in-memory review, object URL cleanup, and no automatic
  IndexedDB write.
- Completed recordings remain transient until the user chooses to save them on
  this device. Quota or save failures keep the in-memory recording while the
  page remains active and allow saving the answer without a recording.
- Review displays timing-safe audio observations and limitation copy without
  ranking communication, fluency, emotion, identity, disability, accent, or
  personality.
- Attempts persist only safe aggregate audio metrics and explicit saved
  recording references. Raw PCM, typed arrays, chunks, and blobs stay inside the
  M07 browser/storage adapters.
- Browser and component coverage covers audio formulas, Web Audio cleanup,
  recorder failures, explicit recording save/discard, route/pagehide cleanup,
  global Stop, keyboard flow, 320 px reflow, and automated axe scans.

### M07.1 - Resume file import

- The setup page adds local file import for PDF, DOCX, and TXT files up to 5
  MiB.
- PDF extraction uses pinned `pdfjs-dist` with a bundled same-origin worker.
  DOCX extraction uses pinned `mammoth`; TXT uses `File.text()`.
- Original `File` objects, filenames, document bytes, parsing buffers, PDF page
  objects, and DOCX archives remain transient and are never persisted.
- Legacy `.doc`, unsupported formats, oversized files, corrupt documents,
  password-protected PDFs, image-only PDFs without OCR text, empty documents,
  and excessive extracted text all produce actionable guidance without
  fabricated success or silent truncation.
- Import status is exposed through sparse live status, error focus, keyboard
  controls, 320 px reflow, and browser axe coverage.
- Dependency and notice documentation covers `pdfjs-dist@6.2.108`,
  `mammoth@1.12.0`, and the bundled Mammoth browser dependencies.

### M07.2 - Upload-only resume input

- Manual resume typing and pasting are removed from setup. The internal
  `resumeText` field remains only as confirmed extracted plain text for the
  deterministic question provider.
- After extraction, users see a success state with file format, extracted
  character count, a collapsed read-only plain-text preview, and explicit Use,
  Choose another file, and Remove resume controls.
- Extracted resume text enters setup state only after the user selects
  **Use this resume**. Existing confirmed resumes require confirmation before
  replacement.
- Changing, replacing, or removing a resume clears stale generated questions,
  keywords, and selection reasons. Users must deliberately generate again with
  the updated context.
- Application version display is injected from `package.json`; footer/config
  tests fail if displayed metadata and package version diverge.

### M08 - Video condition measurement

- The interview answering state can start an optional real camera preview with
  hide/show and display-only mirror controls. The camera never starts during
  preparation, route load, or reload resume flows.
- Microphone-only, camera-only, combined camera-and-microphone, and no-recording
  answer paths are supported. Recordings remain transient until the user
  explicitly saves them in review.
- Persistent microphone, camera, analysis, and recording statuses are visible
  beside the persistent global Stop media control.
- MediaPipe Tasks Vision Face Landmarker `0.10.35`, WASM files, and the pinned
  `face_landmarker.task` model are served same-origin and lazy-loaded in a
  dedicated worker only after camera analysis is enabled.
- The worker uses queue depth one, drops stale frames, disposes frame handles,
  and emits only approved aggregate video-condition observations.
- Video metrics cover face presence, centering, framing, near-camera
  orientation, brightness, multi-face status, sampled/dropped counts, and
  unavailable/partial failure states.
- Raw frames, pixels, landmarks, transformation matrices, blendshapes, object
  URLs, and worker internals are never persisted or exported. Video observations
  do not feed answer-content analysis.
- Camera, MediaPipe, model, worker, recorder, and cleanup failures degrade to
  unavailable or partial video metrics without ending the interview or
  destroying audio, timing, notes, recording review, or saved attempts.
- Unit, component, worker-protocol, integration, privacy, lifecycle,
  recording-mode, accessibility, and browser coverage exercises the M08
  contract.

### M08.1 - Production Worker bundling repair

- The production video-analysis Worker now uses a Vite-supported static Worker
  factory and emits executable browser JavaScript rather than copied TypeScript.
- Tests still inject Worker factories for unit coverage, but production
  evidence comes from the real bundled Worker path.
- `npm run audit:build` verifies the emitted Worker artifact is JavaScript,
  contains no TypeScript-only syntax, has no unresolved source/bare imports, and
  is not preloaded from the initial HTML.
- Browser smoke coverage starts a camera-enabled answer with mocked local media,
  observes the real production Worker request, and verifies the Worker reaches
  active or explicitly handled initialization status without external requests.

### M08.2 - Session lifecycle and combined-media reliability repair

- Every explicitly started interview receives a fresh session ID, including
  repeated starts with the same job title and generated questions.
- **Start another interview** clears the completed progress record, preserves
  setup fields for convenience, and never carries over completion state,
  attempts, selected attempts, media state, notes, or transient recordings.
- Device review blocks **Begin practice** until every requested camera or
  microphone has been tested or explicitly skipped with **Continue without**.
- New interview snapshots use the latest camera, microphone, recording, timing,
  and question settings from setup/device review.
- Combined recording stream creation uses live tracks only. The UI says
  "Recording camera and microphone in memory" only when one live video track and
  one live audio track are present.
- M11 now builds on this lifecycle with safe local checkpoints, explicit report
  reopening, exports, and scoped saved-recording deletion.

### M08.3 - Job context, company research, resume metadata, navigation, and packaging

- Setup now separates company name, company website URL, and job posting URL.
  HTTP/HTTPS URLs are validated and normalized while preserving the original
  typed source URL.
- Job posting import is explicit and provider-backed. The default browser bundle
  does not fetch postings; a configured server-side provider is required for
  retrieval, with blocked/unsupported sites falling back to pasted descriptions.
- Optional company research is consent-gated. The provider request may include
  company name, company website, job title, and job-posting URL only; resumes,
  answers, recordings, transcripts, notes, camera data, microphone data, and
  saved sessions are excluded.
- Research output supports fact/inference/anecdotal labels, source inspection,
  candidate disambiguation, inclusion toggles, refresh/delete, and local
  question-generation prompts.
- Resume setup now stores safe filename metadata, detected format, file size,
  import timestamp, and extraction status. It never stores or displays local
  filesystem paths.
- Main navigation is sticky with a translucent, high-contrast fallback and
  scroll padding so route headings and focused controls are not hidden beneath
  it.
- Release ZIP packaging is verified with forward-slash archive paths for
  portable Windows/POSIX extraction.

### M09 - Reviewed transcription and understandable delivery review

- Manual, timing-only, and opt-in browser speech-recognition paths share a typed
  transcript lifecycle with explicit capability and processing disclosures.
- Browser-generated text remains unreviewed until the user confirms or edits it;
  original and reviewed revisions are retained separately.
- Review shows transcript-first guidance, plain-language unavailable states, and
  optional technical calculation details rather than unexplained metric rows.
- Content analysis never runs on unreviewed browser-generated text.

### M10 - Question-aware coaching and real live prompts

- Deterministic coaching uses the question, approved job context, approved
  company research, résumé evidence, and reviewed transcript only.
- Review presents an overall takeaway, answer summary, strengths, improvements,
  a grounded stronger-answer framework, likely follow-ups, and a next action.
- Nonsense, silence, filler, and insufficient answers receive an honest
  insufficient-content result without invented praise.
- Live coaching now has four real modes: off, delivery/timing, answer structure,
  or both. Prompts are dismissible, limited to one at a time, and share a
  cooldown.
- Video conditions remain structurally excluded from answer-content analysis.

## M11 - Reports, saved sessions, notes, deletion, and export

- Interview progress is projected into validated local IndexedDB records after
  safe state transitions, with sessionStorage retained as a tab-level fallback.
- Saved Sessions supports search, composed status filters, sorting, Resume,
  Review, Practice again, Rename, versioned JSON export, and confirmed deletion.
- Reports reopen without requesting media access and present reviewed answer
  content before separate audio timing and video-call condition observations.
- Users select which retry appears in a report; FairScreen does not calculate a
  best attempt or combine content, audio, and video into one score.
- Text and JSON exports exclude recordings. Recordings can be loaded or deleted
  separately without deleting the interview.
- Settings now exposes local preferences, storage summaries, reset controls, and
  confirmed deletion of saved browser data.

## Intentionally not implemented yet

- The former Fairness Lab page is intentionally removed. Its responsible-use guidance remains in Methodology.
- Backend, account, sync, analytics, tracking, remote logging, remote runtime
  assets, service worker/PWA, remote AI provider, or deployment.

## Architecture boundaries

- Pages never call IndexedDB, storage, media, speech, or worker APIs directly.
- Domain code imports no React, DOM, IndexedDB, `Blob`, or browser types.
- Infrastructure implements browser and storage ports.
- Content analysis types have no video input.
- Routes do not open storage or request media merely by loading.
- Resume file parsing is user-triggered and stays behind an injected browser
  service; setup persists only user-confirmed extracted plain text.
- Browser storage is best effort, origin-scoped, and not described as encrypted,
  permanent, or guaranteed.
- Optional video analysis stays behind injected browser services and starts only
  from the answering flow after the user selected camera analysis.
- Company research and job posting import stay behind injected provider
  interfaces. Provider secrets and URL retrieval must live outside the browser
  bundle; the default static app returns clear unavailable/fallback states.

## Manual checks still required

- Inspect M02 keyboard and screen-reader behavior with NVDA and VoiceOver.
- Review colour contrast with an independent calculator.
- Manually exercise M04 permission grant, denial, dismissal, and
  device-switching paths in current Chrome, Firefox, and Safari.
- Manually exercise M06 flexible, strict-practice, untimed, repeat, skip, exit,
  reload, and attempt-selection flows with NVDA, VoiceOver, and browser zoom.
- Manually exercise M07 microphone capture, recording save/discard, quota
  recovery, browser-denied microphone paths, and object URL cleanup in current
  Chrome, Firefox, and Safari.
- Manually exercise M08 camera preview, mirror and hide controls, camera-only
  recording, combined camera-and-microphone recording, MediaPipe unavailable
  fallback, device replacement, pagehide cleanup, and object URL cleanup in
  current Chrome, Firefox, and Safari.
- Manually exercise M08.3 real provider-backed job posting import and company
  research in Chrome, Edge, Firefox, and Safari, including CORS/auth/anti-bot
  failures, stale/ambiguous sources, and deletion/research refresh behavior.
- Manually exercise M09 browser speech-recognition disclosure, denial,
  unsupported-browser fallback, transcript editing, retry, and manual entry.
- Manually exercise all M10 live-prompt modes, prompt dismissal/cooldown,
  insufficient-content handling, résumé grounding, and keyboard/screen-reader
  review order.
- Manually import representative real-world PDF, DOCX, TXT, legacy DOC,
  password-protected PDF, scanned PDF, corrupt document, and over-limit resume
  files in current Chrome, Firefox, and Safari, confirming the read-only preview
  before use.
- Complete human editorial review of the M05 question catalogue using
  `docs/question-catalogue-review.md`.
- Inspect a fresh M03 database and upgrade behavior in current Chrome, Firefox,
  and Safari developer tools.
- Document observed private-browsing storage behavior without generalizing it
  into a guarantee.
- Review package licences and third-party notices.
