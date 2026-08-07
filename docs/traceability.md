# M01-M10 Traceability

Specification version: `1.0`

Primary guide: `docs/spec/10_FairScreen_Codex_Handoff.md`

## Quality gates

| Acceptance criterion                                                                                           | Evidence                                                                                               |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Clean exact-pinned install                                                                                     | `npm ci`; `package-lock.json`                                                                          |
| Formatting, lint, and strict type-check pass                                                                   | `npm run format:check`; `npm run lint`; `npm run typecheck`                                            |
| Unit/component/integration fixtures pass                                                                       | `npm run test`; `src/**/*.test.{ts,tsx}`                                                               |
| Real-browser non-root routing and accessibility smoke pass                                                     | `npm run browser`; `tests/browser/shell.spec.ts`                                                       |
| Production build passes                                                                                        | `npm run build`                                                                                        |
| No runtime remote request, analytics/tracking package, secret-shaped configuration, or prohibited product copy | `npm run audit:deps`; `npm run scan:secrets`; `npm run scan:language`; Playwright request interception |
| Routes do not access storage/media/capability APIs on load                                                     | `tests/browser/shell.spec.ts`; infrastructure-boundary source audit                                    |

## M01 - Foundation

| Requirement area                                                      | Evidence                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Static strict-TypeScript architecture and pinned toolchain            | `package.json`; `tsconfig*.json`; Vite/Vitest/ESLint configuration |
| Semantic accessible shell, hash routing, focus, and resource cleanup  | `src/app/*`; `src/shared/*`; app/component tests                   |
| Focus, contrast, motion, forced-colour, print, and 320 px foundations | `src/styles/*`; token tests; Playwright                            |
| Privacy/security gates                                                | `scripts/check-*`; `scripts/audit-dependencies.mjs`                |

## M02 - Public experience

| Acceptance criterion                                                                       | Evidence                                                                 |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Home, Privacy, Methodology, Accessibility, and public Fairness education are complete      | `src/pages/{Home,Privacy,Methodology,Accessibility,FairnessLab}Page.tsx` |
| Sitemap routes have unique titles/headings and active navigation                           | `src/app/routes.tsx`; `DocumentTitleManager`; app and browser tests      |
| Desktop/mobile navigation, skip link, disclosure, empty states, and keyboard focus work    | `AppShell`; shared components; Playwright                                |
| 320 px reflow, reduced motion, forced colours, print, and serious/critical axe checks pass | `tests/browser/shell.spec.ts`                                            |
| Public routes make no external request or browser capability/storage call                  | Playwright interception/instrumentation                                  |

## M03 - Local data

| Acceptance criterion                                                                                                   | Evidence                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Canonical models, branded factories, enums, unions, invariants, and ports have no browser/framework dependency         | `src/domain/{common,models,factories,invariants,ports}.ts`; domain tests                 |
| Settings defaults are validated and session snapshots remain immutable                                                 | `src/features/settings/defaults.ts`; domain/repository tests                             |
| Zod validates persistence, export, external config, and worker-result boundaries                                       | `src/infrastructure/storage/schemas/*`; `src/app/config.ts`; schema tests                |
| Persistence guards reject raw media-derived data, interim/unreviewed text, binary leakage, and analysis/video coupling | `repositoryGuards.ts`; schema/guard tests                                                |
| IndexedDB version 1 has exact stores/indexes and ordered idempotent migrations                                         | `db/schema.ts`; `migrations/*`; fake IndexedDB integration tests                         |
| Persistent and ephemeral adapters implement the same browser-free port                                                 | `IndexedDbFairScreenRepository.ts`; `EphemeralFairScreenRepository.ts`; repository tests |
| Failed writes do not report or persist success                                                                         | injected quota/commit tests in both repository suites                                    |
| Corrupt records are isolated without deletion                                                                          | quarantine tests and metadata-only assertions                                            |
| A newer schema opens read-only recovery and rejects writes                                                             | future-version repository tests                                                          |
| Search uses approved metadata/question/note fields and excludes resume/job-description/transcript/binary content       | `src/domain/search.ts`; domain and repository tests                                      |
| Deletion scopes cascade only documented dependents; settings inclusion is explicit                                     | `deletionPlan.ts`; deletion and repository tests                                         |
| Demo records are deterministic, `demo:` namespaced, idempotent, and separately removable                               | `src/features/demo/seed.ts`; schema/ephemeral tests                                      |
| Storage estimate is approximate and absence/failure is non-fatal                                                       | `storageEstimate.ts`; adapter tests                                                      |
| Recording binary is isolated from domain models and requires the explicit infrastructure save method                   | `IndexedDbRecordingRepository.ts`; synthetic-Blob repository test                        |

## M04 - Setup, capability report, permissions, and device check

| Acceptance criterion                                                                                                  | Evidence                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Setup form covers required context, defaults, timing, support choices, optional media, and custom drafts              | `src/features/setup/SetupPage.tsx`; `src/features/setup/setupDraft.ts`; `setupDraft.test.ts`; `App.test.tsx` |
| Setup validation preserves valid input and focuses an error summary                                                   | `validateSetupDraft`; `SetupPage`; `App.test.tsx`                                                            |
| Unsaved setup input is protected on page unload and kept through setup/device navigation                              | `SetupDraftProvider`; `SetupPage`; `App.test.tsx`                                                            |
| Capability report covers required browser support rows and never converts unknown to unavailable                      | `src/infrastructure/browser/capabilities.ts`; `capabilities.test.ts`; `DeviceCheckPage.tsx`                  |
| MediaRecorder MIME candidates are reported independently without trial recording                                      | `capabilities.ts`; `capabilities.test.ts`                                                                    |
| Camera and microphone permission requests are separate and user-triggered                                             | `src/infrastructure/browser/mediaDevices.ts`; `DeviceCheckPage.tsx`; `DeviceCheckPage.test.tsx`              |
| No permission prompt happens on route load or support re-check                                                        | `tests/browser/shell.spec.ts`; `DeviceCheckPage.test.tsx`                                                    |
| Denial, unavailable, and pending states preserve setup data and offer camera-only, microphone-only, or no-media paths | `DeviceCheckPage.tsx`; `DeviceCheckPage.test.tsx`; `mediaDevices.test.ts`                                    |
| Default device selectors work before labels and refresh after permission                                              | `mediaDevices.ts`; `mediaDevices.test.ts`; `DeviceCheckPage.tsx`                                             |
| Camera preview includes hide/show and display-only mirror controls                                                    | `DeviceCheckPage.tsx`; `src/styles/global.css`                                                               |
| Microphone meter has a text/accessibility equivalent                                                                  | `audioLevels.ts`; `audioLevels.test.ts`; `DeviceCheckPage.test.tsx`                                          |
| Replaced or stopped streams and audio resources are cleaned up through the global resource registry                   | `ResourceRegistryProvider`; `DeviceCheckPage.tsx`; `DeviceCheckPage.test.tsx`; `mediaDevices.test.ts`        |
| Limited mode and ephemeral storage fallback are visible without creating local records                                | `DeviceCheckPage.tsx`; `BrowserCapabilityService`; `README.md`                                               |
| Pages consume injected services instead of direct browser media/capability calls                                      | `BrowserServicesProvider`; `scripts/audit-dependencies.mjs`; `tests/browser/shell.spec.ts`                   |

## M05 - Deterministic local question generation

| Acceptance criterion                                                                              | Evidence                                                                                                      |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Catalogue has at least 60 valid unique IDs with at least 12 entries in each required bank         | `src/features/questions/catalogue.ts`; `src/features/questions/questions.test.tsx`                            |
| Normalized duplicate prompts are detected                                                         | `src/features/questions/normalization.ts`; `questions.test.tsx`                                               |
| Role-term extraction is local, capped, stop-word filtered, deterministic, and source/weight typed | `src/features/questions/extractor.ts`; `questions.test.tsx`                                                   |
| Same input and seed produce deep-equal selection and order                                        | `src/features/questions/LocalQuestionProvider.ts`; `questions.test.tsx`                                       |
| Selection prevents duplicates and uses documented recovery fallback on exhaustion                 | `LocalQuestionProvider.ts`; `catalogue.ts`; `questions.test.tsx`                                              |
| Custom questions validate duplicates and support add/edit/remove/reorder before snapshot          | `src/features/questions/customQuestions.ts`; `src/features/setup/SetupPage.tsx`; `questions.test.tsx`         |
| Final rendered question snapshots are stored in setup state for later milestones                  | `SetupDraftProvider`; `setupDraft.ts`; `SetupPage.tsx`; `questions.test.tsx`                                  |
| Page components depend on a provider port and support fake provider replacement                   | `src/features/questions/QuestionProviderContext.tsx`; `LocalQuestionProvider.ts`; `questions.test.tsx`        |
| No network, LLM, secret, or sensitive-input logging is introduced                                 | `scripts/audit-dependencies.mjs`; `scripts/check-secrets.mjs`; provider implementation has no logging/network |
| Editorial review remains a named human gate                                                       | `docs/question-catalogue-review.md`                                                                           |

## M06 - Interview workflow and state machine

| Acceptance criterion                                                                                          | Evidence                                                                                                               |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Reducer exposes exactly the six approved states and valid/invalid transition coverage                         | `src/features/interview/machine.ts`; `src/features/interview/machine.test.ts`                                          |
| Invalid events and duplicate activations produce privacy-safe diagnostic codes without user text              | `machine.ts`; `machine.test.ts`; `InterviewPage.test.tsx`                                                              |
| Flexible, strict-practice, and untimed timing derive from injected timestamps rather than tick counts         | `src/features/interview/timing.ts`; `machine.test.ts`; `InterviewPage.tsx`                                             |
| Flexible mode never hard-stops an answer; strict-practice expiry interrupts only that explicit mode           | `timing.ts`; `machine.test.ts`                                                                                         |
| Strict-practice warnings, one-action extension, overtime, and tab-throttled threshold jumps are covered       | `timing.ts`; `machine.test.ts`                                                                                         |
| Sparse timer announcements and the silence setting are covered                                                | `timing.ts`; `machine.test.ts`; `InterviewPage.test.tsx`                                                               |
| Start, Finish, Repeat, Skip, End, Extend Time, preview visibility, Exit, and global Stop controls are present | `InterviewPage.tsx`; `InterviewPage.test.tsx`; `tests/browser/shell.spec.ts`                                           |
| In-progress discard paths require confirmation                                                                | `InterviewPage.tsx`; `InterviewPage.test.tsx`                                                                          |
| Retry attempts are timestamped separately and report display selection is user-chosen                         | `machine.ts`; `progressPersistence.ts`; `machine.test.ts`; `InterviewPage.test.tsx`                                    |
| Safe progress persistence projects through the M03 repository port                                            | `progressPersistence.ts`; `progressPersistence.test.ts`; `EphemeralFairScreenRepository`                               |
| Reload recovery returns to safe non-capturing states and does not restart timers/devices                      | `progressPersistence.ts`; `InterviewPage.test.tsx`; `progressPersistence.test.ts`                                      |
| Cleanup events remain compatible with the M04 resource registry Stop path                                     | `machine.ts`; `InterviewPage.tsx`; `machine.test.ts`; `InterviewPage.test.tsx`; `src/shared/media/resourceRegistry.ts` |
| Keyboard-only journey, 320 px reflow, and automated accessibility scans pass                                  | `InterviewPage.test.tsx`; `tests/browser/shell.spec.ts`; `npm run browser`                                             |
| M11 reports, exports, saved-session UI, and M12 Fairness Lab workflows remain excluded                        | `InterviewPage.tsx`; `progressPersistence.ts`; `README.md`; language/audit/build gates                                 |

## M07 - Audio measurement and recording

| Acceptance criterion                                                                                           | Evidence                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Audio metrics use approved formulas and persist aggregates only                                                | `src/features/audio/audioMetrics.ts`; `src/features/audio/audioMetrics.test.ts`; `src/domain/models.ts`                      |
| Web Audio starts only from user-selected microphone capture and cleans up graph resources                      | `src/infrastructure/browser/webAudioAnalyzer.ts`; `src/infrastructure/browser/webAudioAnalyzer.test.ts`; `InterviewPage.tsx` |
| Raw PCM/time-domain arrays do not cross analyzer or persistence boundaries                                     | `webAudioAnalyzer.ts`; `audioMetrics.ts`; `progressPersistence.ts`; `repositoryGuards.ts`; serialization tests               |
| MediaRecorder uses ordered MIME fallback and handles unsupported, rejected, runtime-error, and zero-byte cases | `src/infrastructure/browser/mediaRecorder.ts`; `src/infrastructure/browser/mediaRecorder.test.ts`                            |
| Recordings remain transient until explicit post-review save and can be discarded                               | `src/features/recording/transientRecording.ts`; `InterviewPage.tsx`; `InterviewPage.test.tsx`                                |
| Recording save failures preserve in-memory review and allow answer-only continuation                           | `src/infrastructure/browser/recordingStorage.ts`; `InterviewPage.tsx`; `InterviewPage.test.tsx`                              |
| Audio/recording capture stops on finish, repeat, skip, end, exit, pagehide, global Stop, and cleanup paths     | `InterviewPage.tsx`; `InterviewPage.test.tsx`; `webAudioAnalyzer.test.ts`; `mediaRecorder.test.ts`                           |
| Review copy avoids speaking-quality, fluency, emotion, identity, disability, accent, and personality claims    | `InterviewPage.tsx`; `audioMetrics.ts`; `scripts/check-prohibited-language.mjs`                                              |
| M11 reports, exports, saved-session UI, and M12 Fairness Lab workflows remain excluded                         | `README.md`; `src/features/transcription/README.md`; build/language/audit gates                                              |

## M07.1/M07.2 - Resume file import and upload-only confirmation

| Acceptance criterion                                                                                                               | Evidence                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Setup uses upload-only PDF, DOCX, and TXT résumé import with no résumé textbox                                                     | `src/features/setup/SetupPage.tsx`; `src/features/setup/SetupPage.test.tsx`; `tests/browser/shell.spec.ts`                             |
| File validation covers 5 MiB limit, legacy DOC guidance, unsupported format, empty, image-only, corrupt, and excessive text states | `src/features/setup/resumeImport.ts`; `src/features/setup/resumeImport.test.ts`; `src/infrastructure/browser/resumeFileImport.test.ts` |
| PDF, DOCX, and TXT parsers are pinned, bundled, same-origin, and user-triggered                                                    | `package.json`; `package-lock.json`; `src/infrastructure/browser/resumeFileImport.ts`; `scripts/audit-dependencies.mjs`                |
| Extracted text is staged in a collapsed read-only preview with format and character count before confirmation                      | `SetupPage.tsx`; `SetupPage.test.tsx`; `tests/browser/shell.spec.ts`                                                                   |
| Only user-confirmed extracted plain text enters `resumeText`; original files, bytes, buffers, and parser objects stay transient    | `resumeFileImport.ts`; `resumeFileImport.test.ts`; `SetupPage.test.tsx`; storage/domain schema guards                                  |
| Existing confirmed résumés require confirmation before replacement                                                                 | `SetupPage.tsx`; `SetupPage.test.tsx`                                                                                                  |
| Changing, replacing, or removing résumé text invalidates stale generated questions and requires deliberate regeneration            | `src/features/setup/setupDraft.ts`; `setupDraft.test.ts`; `SetupPage.test.tsx`; `questions.test.tsx`                                   |
| Import status, error focus, keyboard operation, 320 px reflow, no external request, and axe checks pass                            | `SetupPage.test.tsx`; `tests/browser/shell.spec.ts`; `npm run browser`                                                                 |
| No document contents, filenames, paths, raw buffers, or parser output are logged or persisted                                      | `resumeFileImport.test.ts`; `scripts/check-secrets.mjs`; `scripts/audit-dependencies.mjs`; repository/schema tests                     |
| Displayed app version comes from package metadata and is tested against `package.json`                                             | `vite.config.ts`; `vitest.config.ts`; `src/app/config.ts`; `src/app/config.test.ts`; `src/app/App.test.tsx`                            |

## M08 - Video condition measurement

| Acceptance criterion                                                                                                     | Evidence                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera preview is real, optional, responsive, hideable, mirrorable, and starts only during answering                     | `src/features/interview/InterviewPage.tsx`; `src/features/interview/InterviewPage.test.tsx`; `tests/browser/shell.spec.ts`                  |
| Microphone-only, camera-only, combined camera-and-microphone, and no-recording answer paths preserve transient review    | `InterviewPage.tsx`; `InterviewPage.test.tsx`; `src/infrastructure/browser/mediaRecorder.test.ts`                                           |
| Persistent microphone, camera, analysis, recording, and global Stop controls remain visible and clean up resources       | `InterviewPage.tsx`; `InterviewPage.test.tsx`; `src/shared/media/resourceRegistry.ts`; browser tests                                        |
| Pinned same-origin MediaPipe Tasks Vision WASM/model assets are lazy-loaded after explicit camera analysis enablement    | `package.json`; `public/mediapipe/*`; `src/app/config.ts`; `src/features/video/videoAnalysis.worker.ts`; dependency audit and browser tests |
| Worker protocol is typed, queue depth is one, stale frames are dropped, and frame handles are disposed                   | `src/features/video/videoWorkerProtocol.ts`; `src/infrastructure/browser/videoAnalysisClient.ts`; `videoAnalysisClient.test.ts`             |
| Approved video-condition formulas and thresholds match the measurement specification                                     | `src/features/video/conditions.ts`; `src/features/video/conditions.test.ts`; `src/features/video/aggregate.test.ts`                         |
| Worker responses and persistence reject raw frames, pixels, landmarks, matrices, blendshapes, and content/video coupling | `videoWorkerProtocol.test.ts`; `aggregate.test.ts`; `progressPersistence.ts`; repository/schema guard tests                                 |
| MediaPipe/model/worker/camera failures degrade without ending interviews or destroying audio, timing, notes, or results  | `InterviewPage.test.tsx`; `videoAnalysisClient.test.ts`; `aggregate.test.ts`                                                                |
| Video observations do not infer prohibited traits and never feed answer-content analysis                                 | `conditions.ts`; `InterviewPage.tsx`; `scripts/check-prohibited-language.mjs`; `scripts/audit-dependencies.mjs`                             |
| Keyboard journey, 320 px reflow, automated axe, no route-load capture, and no external requests pass                     | `tests/browser/shell.spec.ts`; `InterviewPage.test.tsx`; `npm run browser`                                                                  |

## M08.1 - Production Worker bundling repair

| Acceptance criterion                                                                                                | Evidence                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Production video Worker is emitted as compiled JavaScript, not copied TypeScript                                    | `src/infrastructure/browser/videoAnalysisClient.ts`; `scripts/audit-build-artifacts.mjs`; `npm run audit:build`          |
| Worker tests keep dependency injection through a Worker factory                                                     | `src/infrastructure/browser/videoAnalysisClient.test.ts`                                                                 |
| Emitted Worker has no TypeScript-only syntax, unresolved source imports, unresolved bare imports, or missing chunks | `scripts/audit-build-artifacts.mjs`; `npm run build`; `npm run audit:build`                                              |
| MediaPipe Worker/model/WASM assets remain same-origin and lazy after camera-analysis activation                     | `tests/browser/shell.spec.ts`; `scripts/audit-build-artifacts.mjs`; `public/mediapipe/*`; `docs/dependency-inventory.md` |
| Production preview starts a camera-enabled answer with mocked local media and observes the real Worker URL          | `tests/browser/shell.spec.ts`; `npm run browser`                                                                         |

## M08.2 - Session lifecycle and combined-media reliability repair

| Acceptance criterion                                                                                         | Evidence                                                                                                 |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Repeated explicit starts with the same job title and questions create unique session IDs                     | `src/features/interview/progressPersistence.ts`; `progressPersistence.test.ts`; `InterviewPage.test.tsx` |
| Start another clears the completed progress record while preserving setup fields for convenience             | `InterviewPage.tsx`; `InterviewPage.test.tsx`; `sessionRoute.ts`                                         |
| Fresh interviews begin at Question 1 with zero attempts and current setup/media settings                     | `InterviewPage.test.tsx`; `SetupPage.tsx`; `DeviceCheckPage.tsx`                                         |
| Requested devices must be tested or explicitly skipped before Begin practice                                 | `DeviceCheckPage.tsx`; `DeviceCheckPage.test.tsx`; browser camera journey                                |
| Camera-only, microphone-only, combined, and no-media recording paths remain supported                        | `InterviewPage.test.tsx`; `DeviceCheckPage.test.tsx`; `tests/browser/shell.spec.ts`                      |
| Combined recording uses one live video track and one live audio track before reporting combined capture      | `InterviewPage.tsx`; `InterviewPage.test.tsx`                                                            |
| Saved navigation remains an explicit M11 placeholder rather than implying implemented saved-session features | `src/app/routes.tsx`; `src/app/App.test.tsx`; `tests/browser/shell.spec.ts`; README                      |
| M11 reports, exports, saved-session UI, and M12 Fairness Lab remain out of scope                             | `README.md`; feature README placeholders; prohibited-language, dependency, build, and browser gates      |

## M08.3 - Job context, company research, resume metadata, navigation, and packaging

| Acceptance criterion                                                                                           | Evidence                                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Job posting URL and company website URL are separate, HTTP/HTTPS-only, normalized, and never fetched on input  | `src/features/setup/jobContext.ts`; `setupDraft.test.ts`; `SetupPage.test.tsx`; `tests/browser/shell.spec.ts` |
| Job posting import is explicit, review-before-apply, and falls back when blocked or unavailable                | `SetupPage.tsx`; `SetupPage.test.tsx`; provider interfaces in `BrowserServicesProvider`                       |
| Company research is consent-gated and excludes resumes, answers, recordings, transcripts, notes, and media     | `SetupPage.tsx`; `SetupPage.test.tsx`; README privacy boundary                                                |
| Ambiguous company names require user selection rather than guessing                                            | `SetupPage.test.tsx`; `CompanyResearchCandidate` model                                                        |
| Research findings carry source attribution, fact/inference/anecdote labels, inclusion toggles, and questions   | `jobContext.ts`; `SetupPage.tsx`; `SetupPage.test.tsx`                                                        |
| Resume filename, format, size, import timestamp, and extraction status are stored without filesystem paths     | `jobContext.ts`; `setupDraft.ts`; `SetupPage.tsx`; `SetupPage.test.tsx`; `jobContext.test.ts`                 |
| Sticky translucent navigation remains keyboard/mobile/forced-colour friendly and avoids hidden anchors         | `src/styles/global.css`; `AppShell`; `tests/browser/shell.spec.ts`                                            |
| Portable release archive uses forward-slash ZIP paths and excludes dependencies, build output, caches, reports | ZIP verification commands recorded in M08.3 completion report                                                 |

## Covered requirement groups

| Requirement group                                       | M01-M10 treatment                                                                                                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-003-FR-024, FR-031, FR-033-FR-037, FR-044-FR-050     | Setup/device workflow, upload-only resume import, deterministic questions, interview state/timing, retries, cleanup, audio/video metrics, recording boundaries |
| NFR-001-NFR-006, NFR-010, NFR-013                       | Static client, strict typing, worker-based MediaPipe, fallible/injected adapters, deterministic fixtures, same-origin boundaries, accessible timing            |
| PRIV-004-PRIV-006, PRIV-008-PRIV-012, PRIV-014-PRIV-017 | Optional permissions, no upload claims, minimal persistence, storage transparency, raw-data guards, safe reload, video minimization, deletion                  |
| ACC-002-ACC-007, ACC-010, ACC-015-ACC-016, ACC-019      | Keyboard journey, focus behavior, sparse announcements, timer/media control, reduced-motion/forced-colour/320 px accessibility coverage                        |
| ERR-002-ERR-005, ERR-008-ERR-010, ERR-014               | Permission alternatives, device unavailability, recorder/storage/MediaPipe fallback, corrupt/future recovery, invalid event and safe recovery                  |

## Manual evidence still required

- NVDA and VoiceOver review of the M02 public routes and M04 setup/device flow.
- Independent colour-contrast review.
- Camera and microphone grant, denial, dismissal, device switching, and pagehide
  cleanup checks in current Chrome, Firefox, and Safari.
- M06 flexible, strict-practice, untimed, repeat, skip, exit, reload, and
  attempt-selection checks with NVDA, VoiceOver, browser zoom, and real tab
  backgrounding.
- M07 microphone capture, recording save/discard, quota recovery,
  browser-denied microphone paths, and object URL cleanup in current Chrome,
  Firefox, and Safari.
- M08 camera preview, mirror and hide controls, camera-only recording, combined
  camera-and-microphone recording, MediaPipe unavailable fallback, device
  replacement, pagehide cleanup, object URL cleanup, and long-session worker
  disposal in current Chrome, Firefox, and Safari.
- M08.3 provider-backed job posting import and company research checks in
  current Chrome, Edge, Firefox, and Safari, including blocked URL, ambiguous
  company, stale source, deletion, refresh, and real source-inspection paths.
- M09 browser speech-recognition disclosure, permission, decline, partial-result,
  retry, manual fallback, and reviewed-revision checks in current Chrome and
  Edge, with unsupported-service checks in Firefox and Safari.
- M10 live-prompt timing, dismissal, cooldown, transcript editing, insufficient
  content, substantive coaching, keyboard, screen-reader, and 320 CSS px review
  checks in current browsers.
- M07.2 real-world PDF, DOCX, TXT, legacy DOC, password-protected PDF, scanned
  PDF, corrupt document, and over-limit resume imports in current Chrome,
  Firefox, and Safari, including preview-before-use and replacement/removal.
- Human editorial review of the M05 question catalogue using
  `docs/question-catalogue-review.md`.
- Fresh-database and version-upgrade inspection in current Chrome, Firefox, and
  Safari.
- Normal/private-mode storage observation in those browsers, documented as
  observed behavior rather than a durability guarantee.

## M09 - Reviewed transcription and delivery review

| Requirement                                                                                              | Evidence                                                                                         |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Manual, timing-only, and capability-gated browser recognition produce typed transcript results           | `src/features/transcription/transcription.ts`; `src/infrastructure/browser/speechRecognition.ts` |
| Browser speech recognition requires an explicit disclosure and can be declined without blocking practice | `InterviewPage.tsx`; `speechRecognition.ts`                                                      |
| Generated text must be reviewed before content analysis and original/reviewed revisions remain distinct  | `transcription.ts`; `InterviewPage.tsx`; `machine.ts`; `progressPersistence.ts`                  |
| Unavailable delivery measurements show a reason and next action rather than rows of unexplained values   | `InterviewPage.tsx` audio/video review panels                                                    |

## M10 - Question-aware coaching and live prompts

| Requirement                                                                    | Evidence                                                                   |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Deterministic feedback uses reviewed transcript and approved practice context  | `src/features/analysis/DeterministicAnswerAnalyzer.ts`                     |
| Nonsense and insufficient content do not receive invented praise               | `DeterministicAnswerAnalyzer.test.ts`                                      |
| Résumé evidence is used only when a relevant source sentence exists            | `DeterministicAnswerAnalyzer.ts`; `DeterministicAnswerAnalyzer.test.ts`    |
| Live prompt modes are off, delivery/timing, answer structure, or both          | `setupDraft.ts`; `SetupPage.tsx`; `InterviewPage.tsx`; `liveCoaching.ts`   |
| Prompts are dismissible, one at a time, and share a cooldown                   | `InterviewPage.tsx`; `liveCoaching.ts`; `liveCoaching.test.ts`             |
| Video measurements are not an analyzer input and never affect content feedback | `DeterministicAnswerAnalyzer.ts`; `InterviewPage.tsx`; domain ports/models |
