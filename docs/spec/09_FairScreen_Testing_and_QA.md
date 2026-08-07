# FairScreen Testing and QA Specification

**Version:** 1.0  
**Date:** 2026-07-28  
**Status:** Release-gating test plan

## 1. Purpose

This document defines the evidence required to release FairScreen. It tests functional correctness, deterministic measurements, accessibility, privacy, responsible-AI boundaries, browser fallbacks, persistence, and exports. Passing happy-path UI tests alone is insufficient.

## 2. Quality policy

- A requirement is complete only when its acceptance criterion has an automated test or a named manual test with recorded evidence.
- Deterministic business rules use fixed inputs, clocks, IDs, random sources, configurations, and algorithm versions.
- Browser capability is observed, not assumed.
- Optional-feature failure must preserve a useful camera-free, microphone-free, manual, or timing-only flow.
- Privacy and responsible-AI tests are release blockers and are not retried into passing.
- Test fixtures contain synthetic content only and no real applicant, résumé, recording, biometric, or device-label data.
- Snapshots may verify stable document structure or approved copy, but not replace behavioral assertions.
- `Not available`, `Partial`, and `Unsupported` are distinct states and must never be represented by numeric zero.

## 3. Test layers

| Layer | Purpose | Primary tools | Runs |
|---|---|---|---|
| Static policy checks | Types, imports, secrets, prohibited language/features, dependency boundaries | TypeScript, ESLint, custom scripts | Every change |
| Unit | Pure reducers, formulas, normalization, schemas, migrations, serializers | Vitest | Every change |
| Component | Semantic interaction and state rendering with fake ports | Testing Library, `axe-core` | Every change |
| Integration | IndexedDB, workers, browser adapters, resource cleanup | Vitest browser/jsdom as appropriate | Every change |
| Browser end-to-end | Complete user paths and browser API fallbacks | Playwright | Pull request and nightly matrix |
| Network/storage audit | No data egress, same-origin assets, prohibited persistence | Playwright interception, IndexedDB inspection | Pull request and release |
| Accessibility manual | Screen reader, keyboard, zoom, forced colors, motion | Named browser/AT combinations | Milestone 13 and release |
| Real-device media | Permission and device behavior not fully simulatable | Supported desktop browsers and hardware | Release candidate |
| Print/export inspection | Accessible, complete, schema-valid artifacts | Browser print preview/PDF, validators | Pull request golden + release manual |

## 4. Test environments

### 4.1 Deterministic automated environment

- Fixed locale: `en-CA`; fixed time zone: `UTC` unless a locale test says otherwise.
- Fake monotonic and wall clocks.
- Seeded ID and random providers.
- Fixed algorithm/config/schema versions.
- Synthetic video frames and audio arrays generated in memory; never retained as application data.
- Fixed model package/version and integrity value.
- Network denied by default except the local test server.
- Job posting import and company research use deterministic fake providers in
  automated tests; no test depends on live company websites or third-party
  research services.

### 4.2 Browser release matrix

Record exact version, operating system, secure-context status, device type, permission result, and date. “Current” means the stable version installed on the test date; “previous” means the immediately preceding major version available to the test program.

| Browser target | Core/static | IndexedDB | Camera/mic | MediaRecorder | Web Audio | Worker/WASM/MediaPipe | Speech recognition | Print/export | Required evidence |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Chrome current/previous, desktop | Required | Required | Required | Observe formats | Required | Required | Observe; fallback required | Required | Automated + real-device |
| Edge current/previous, desktop | Required | Required | Required | Observe formats | Required | Required | Observe; fallback required | Required | Automated + real-device |
| Firefox current/previous, desktop | Required | Required | Required | Observe formats | Required | Required | Treat speech as capability-dependent | Required | Automated + real-device |
| Safari current/previous, macOS | Required | Required | Required | Observe formats | Required | Required | Treat speech as capability-dependent | Required | Automated where possible + manual |
| Safari current, iOS | Responsive limited mode | Observe | Observe | Observe | Observe | Observe/performance | Manual fallback required | Observe | Manual smoke |
| Chrome current, Android | Responsive limited mode | Observe | Observe | Observe | Observe | Observe/performance | Observe; fallback required | Observe | Manual smoke |

No untested browser is labeled supported. A missing optional API is a limited mode, not necessarily a defect.

### 4.3 Viewport and preference matrix

At minimum test:

- 320 × 568, 375 × 667, 768 × 1024, 1024 × 768, and 1440 × 900 CSS px;
- portrait and landscape where applicable;
- 200% browser zoom;
- WCAG text-spacing overrides;
- `prefers-reduced-motion: reduce`;
- `prefers-contrast: more` where supported;
- Windows forced-colors mode;
- default and user-selected high-contrast themes.

## 5. Static and architecture tests

| Test ID | Assertion | Requirement coverage |
|---|---|---|
| STATIC-001 | Strict TypeScript build passes with all required flags and no production `any`. | NFR-002 |
| STATIC-002 | Feature dependency rules prevent pages from importing browser APIs or IndexedDB directly. | NFR-010 |
| STATIC-003 | `AnswerAnalyzer` and its import graph cannot import or accept `VideoMetrics`. | FR-024, PRIV-013 |
| STATIC-004 | No model, route, chart, export, or fixture defines an overall/combined suitability, competence, confidence, employability, personality, or performance score. | FR-029, PRIV-013 |
| STATIC-005 | Prohibited inference/language scan rejects identity, emotion, demographic, disability, medical, honesty, intent, anti-cheating, and trait-output implementations; reviewed education-only references are allowlisted. | FR-002, FR-029, PRIV-013 |
| STATIC-006 | Production dependencies contain no analytics, advertising, tracking, session replay, remote error reporting, remote font, remote icon, or remote model loader. | NFR-008, NFR-012, PRIV-011, PRIV-016 |
| STATIC-007 | Secret scan finds no credential, private endpoint token, or secret-bearing Vite variable. | FR-047 |
| STATIC-008 | Persistence and export schemas cannot represent raw frame/image, landmarks, blendshapes, matrices, PCM arrays, or embedded recording data. | PRIV-004–PRIV-006, PRIV-012 |
| STATIC-009 | Every optional browser adapter implements capability, timeout/error normalization, fallback, and cleanup contracts. | NFR-005 |
| STATIC-010 | Circular dependency and worker-boundary scans pass. | NFR-003, NFR-010 |
| STATIC-011 | All local model/WASM/font/icon assets have same-origin paths, pinned versions, licenses, and integrity inventory. | PRIV-003, PRIV-016 |
| STATIC-012 | Documentation references schema, config, and algorithm versions and the current product specification. | NFR-013, FR-050 |
| STATIC-013 | M08.3 job posting import and company research have no browser-bundled provider key, direct remote crawl, or source route that sends resumes, answers, recordings, notes, transcripts, camera/microphone data, saved sessions, or local file paths. | PRIV-011, PRIV-016 |

## 6. Unit and deterministic fixture tests

### 6.1 Domain, state, and persistence

| Test ID | Fixture/assertion | Requirement coverage |
|---|---|---|
| UNIT-DOM-001 | Runtime schemas accept every valid domain fixture and reject missing, extra-prohibited, invalid-enum, invalid-date, and future-version fields as specified. | FR-050, NFR-002 |
| UNIT-DOM-002 | Session snapshots remain unchanged after global settings change. | FR-004, FR-036 |
| UNIT-DOM-003 | Every interview state/event pair matches the approved transition table; invalid events are privacy-safe. | FR-017 |
| UNIT-DOM-004 | Fake-clock tests cover flexible, strict, untimed, warning, overtime, extension, tab-throttle, and double-activation behavior. | FR-018–FR-019, ACC-006–ACC-007 |
| UNIT-DOM-005 | Recovery selects a non-capturing state and the correct next question/attempt. | FR-035 |
| UNIT-DOM-006 | Retry creates a distinct attempt and never auto-selects a “best” attempt. | FR-031 |
| UNIT-DB-001 | Each ordered migration upgrades from every supported version and is idempotent. | FR-050 |
| UNIT-DB-002 | Cascade plans remove only documented dependents for recording, response, trial, comparison, session, demo, and all-data scopes. | FR-033, FR-045 |
| UNIT-DB-003 | Demo seeding is deterministic, namespaced, idempotent, and separately removable. | FR-042, FR-045 |
| UNIT-DB-004 | Search normalization and composed filters match only allowed fields and never inspect recording binary. | FR-034 |
| UNIT-DB-005 | Unsupported future schema enters read-only recovery/export; corrupt records quarantine independently. | FR-050, ERR-010 |

### 6.2 Questions

| Test ID | Fixture/assertion | Requirement coverage |
|---|---|---|
| UNIT-Q-001 | Catalogue has at least 60 valid unique IDs and at least 12 entries in each required bank. | FR-013 |
| UNIT-Q-002 | Normalized duplicate prompts fail the catalogue check. | FR-013 |
| UNIT-Q-003 | Role-term extraction is local, capped, stop-word filtered, deterministic, and returns source/weight; blank input returns defaults. | FR-014 |
| UNIT-Q-004 | Same inputs and seed produce deep-equal question selection and order. | FR-015, NFR-006 |
| UNIT-Q-005 | Selection prevents duplicates and invokes documented fallback on bank exhaustion. | FR-015 |
| UNIT-Q-006 | Custom add/edit/remove/reorder rejects empty/duplicate items and snapshots at least one valid final question. | FR-016 |
| UNIT-Q-007 | A fake provider can replace the local provider without page changes. | FR-046 |
| UNIT-Q-008 | M08.3 HTTP/S URL normalization, safe filename metadata, job import snapshots, and included company-research findings are deterministic and invalidate stale generated question snapshots when changed. | FR-014-FR-016, PRIV-011 |

### 6.3 Audio measurements

Use the exact input arrays, sample rates, tolerances, formulas, and threshold versions in the Measurement Specification.

| Test ID | Fixture/assertion | Requirement coverage |
|---|---|---|
| UNIT-AUD-001 | RMS of silence, full scale, a known sine, and mixed samples is correct; zero handling never computes an invalid logarithm. | FR-022 |
| UNIT-AUD-002 | dBFS conversion, floor clamp, and calibration noise floor match the specification. | FR-022 |
| UNIT-AUD-003 | Adaptive VAD start/end hysteresis and minimum segment duration match boundary fixtures. | FR-022 |
| UNIT-AUD-004 | Speech duration, silence duration, first-speech delay, pause count/duration, level range, clipping ratio, and coverage use approved denominators. | FR-022 |
| UNIT-AUD-005 | No sample, all unavailable, short calibration, interrupted capture, and partial input produce correct availability/failure metadata. | FR-022, ERR-004, ERR-006 |
| UNIT-AUD-006 | Metrics contain sample count, algorithm/config version, thresholds, and limitations; labels contain no trait interpretation. | FR-022, PRIV-013 |
| UNIT-AUD-007 | Raw arrays are absent from aggregate output and serialization. | PRIV-006 |

### 6.4 Video measurements

| Test ID | Fixture/assertion | Requirement coverage |
|---|---|---|
| UNIT-VID-001 | Face presence and multi-face rates use sampled-frame denominators and distinguish no result from zero. | FR-023 |
| UNIT-VID-002 | Approximate centring geometry handles each boundary, mirror-display independence, and missing landmarks. | FR-010, FR-023 |
| UNIT-VID-003 | Framing ratios and labels match threshold fixtures for too close, expected range, too far/partial, and unavailable. | FR-010, FR-023 |
| UNIT-VID-004 | Near-camera orientation calculation and cautious band labels match approved matrix fixtures. | FR-023 |
| UNIT-VID-005 | Brightness sampling and bands match synthetic frames; backlighting output remains feature-flagged off until its gate. | FR-010, FR-023 |
| UNIT-VID-006 | Sampled/dropped/failure counts, partial coverage, timestamp monotonicity, and queue-depth-one behavior are correct. | NFR-003, ERR-012 |
| UNIT-VID-007 | Worker-to-main result messages contain aggregates only and reject frame, landmark, blendshape, or matrix fields; main-to-worker transferable frames are closed and not retained. | PRIV-004–PRIV-005 |
| UNIT-VID-008 | Mutating every video fixture produces byte-identical content analysis. | FR-024 |

### 6.5 Transcription and answer analysis

| Test ID | Fixture/assertion | Requirement coverage |
|---|---|---|
| UNIT-TX-001 | Interim/final speech events merge without duplication and preserve finalized text on error. | FR-025, ERR-007 |
| UNIT-TX-002 | Automatic transcript remains unreviewed after capture; an edit creates a reviewed revision while transient recognition state remains separate; persistence rejects unreviewed/interim text. | FR-026 |
| UNIT-TX-003 | Manual and timing-only providers satisfy the same completion contract. | FR-025, ACC-012 |
| UNIT-AN-001 | Every documented rule has below/at/above-threshold fixtures and the exact required prerequisites. | FR-027 |
| UNIT-AN-002 | Ratings are limited to `strong`, `developing`, `needsMoreEvidence`, `notAvailable`, and `notApplicable`. | FR-028 |
| UNIT-AN-003 | Evidence spans resolve to the reviewed transcript and invalid offsets fail validation. | FR-027 |
| UNIT-AN-004 | Missing transcript, word timing, question terms, or language support yields correct unavailable/not-applicable categories. | FR-027–FR-028 |
| UNIT-AN-005 | Same input/config/version yields deep-equal output; changed clock/ID cannot affect analysis. | NFR-006 |
| UNIT-AN-006 | Golden fixtures cover relevance, specificity, example, contribution, outcome, measurable evidence, STAR, repetition, filler language, length, pace, and clarity/concision. | FR-027 |
| UNIT-AN-007 | Messages use approved cautious language and never invent facts or state a trait/overall score. | FR-028–FR-029, NFR-007 |

### 6.6 Fairness similarity

| Test ID | Fixture/assertion | Requirement coverage |
|---|---|---|
| UNIT-FAIR-001 | Normalization applies the specified Unicode/case/punctuation/whitespace rules without silently translating or stemming. | FR-040 |
| UNIT-FAIR-002 | Token-frequency unigram cosine and ordered-word-trigram Jaccard match hand-calculated fixtures, including empty sets. | FR-040 |
| UNIT-FAIR-003 | Weighted score is exactly `0.60 × cosine + 0.40 × Jaccard`. | FR-040 |
| UNIT-FAIR-004 | Exact, substantially unchanged, similar, and different bands match score and word-count guards immediately below/at/above boundaries. | FR-040 |
| UNIT-FAIR-005 | Group invariance requires every pair to qualify; missing data does not qualify. | FR-040–FR-041 |
| UNIT-FAIR-006 | Exact approved invariance statement is selected only for qualifying comparisons. | FR-041 |
| UNIT-FAIR-007 | Seeded four-condition demo is deep-equal to the documented transcript and metrics. | FR-042 |

### 6.7 Export

| Test ID | Fixture/assertion | Requirement coverage |
|---|---|---|
| UNIT-EXP-001 | Filenames are safe across supported operating systems and cannot inject a path. | FR-032 |
| UNIT-EXP-002 | JSON exports validate against their versioned schemas and reject unknown future versions on import/recovery. | FR-032, FR-050 |
| UNIT-EXP-003 | Plain text and JSON omit Blob/recording content and include selected sensitivity fields only. | FR-032, PRIV-012 |
| UNIT-EXP-004 | Report export contains the fairness warning and Fairness comparison contains the invariance statement when required. | FR-030, FR-041, FR-043 |
| UNIT-EXP-005 | Comparison export includes similarity components, word-count difference, conditions, and causal/bias limitations without a competence conclusion. | FR-040, FR-043 |
| UNIT-EXP-006 | Missing/partial measurements retain availability and limitations rather than serializing zero. | FR-030 |

## 7. Component and interaction tests

| Test ID | Scenario | Key assertions | Requirement coverage |
|---|---|---|---|
| COMP-001 | Home/education routes | Exact critical copy, primary actions, limitations, no permission calls | FR-001–FR-002 |
| COMP-002 | Setup validation | Labels, required/optional, error summary links, ranges, defaults, preservation | FR-003–FR-004, ACC-004 |
| COMP-003 | Capability report | All required capability rows/statuses/help; re-run does not prompt | FR-005, FR-012 |
| COMP-004 | Permission disclosure | Explanation precedes request; denial/dismissal offers limited mode | FR-006, FR-009, PRIV-001 |
| COMP-005 | Device selection | Default-before-label, refreshed labels, old resource stopped | FR-007–FR-008 |
| COMP-006 | Camera checks | Neutral conditions, uncertainty, skip/continue, no trait wording | FR-010 |
| COMP-007 | Interview controls | State-appropriate actions, double-click guard, persistent Exit/Stop | FR-017–FR-021 |
| COMP-008 | Live coaching | Off by default, descriptive-only, independent disable | FR-020, ACC-015 |
| COMP-009 | Transcript review | Manual/editable path, speech disclosure, review gate, timing-only path | FR-025–FR-026 |
| COMP-010 | Analysis feedback | Category, evidence, suggestion, limitations; no overall score | FR-027–FR-030 |
| COMP-011 | Report attempts | Retry retained; user selects report attempt; no algorithmic “best” | FR-031 |
| COMP-012 | Sensitive export preview | Included fields accurate; recordings excluded | FR-032, PRIV-012 |
| COMP-013 | Deletion dialogs | Exact scope, focus trap/return, success after commit, all-data two step | FR-033, FR-037 |
| COMP-014 | Saved sessions | Search/sort/filter composition and distinct empty/no-result/error | FR-034–FR-035 |
| COMP-015 | Settings | All controls/defaults/ranges; reset distinct from delete | FR-036–FR-037 |
| COMP-016 | Recording review | Capture choice and save choice are distinct; discard and quota error work | FR-048–FR-049 |
| COMP-017 | Fairness trial editor | Required/custom condition labels, same-question group, labels are user-described | FR-038 |
| COMP-018 | Fairness comparison | Answer Content first, separate tables, no joined row/chart, exact statement | FR-039–FR-041 |
| COMP-019 | Seeded demo | Permission-free load, synthetic label, idempotent remove | FR-042, FR-045 |
| COMP-020 | Notes | Correct scope, export opt-in, never analyzed | FR-044 |
| COMP-021 | Live regions | Sparse state/timer/record/save/delete/error announcements, no duplicates | ACC-005, ACC-007 |
| COMP-022 | Accessibility alternatives | Hide preview/coaching/meters; table/text equivalent; no loss of function | ACC-013–ACC-018 |
| COMP-023 | M08.3 job context and company research | Dedicated job URL/company site fields, explicit import, review-before-apply, consent, include/exclude, source inspection, delete, local-only fallback, resume filename card, sticky nav | FR-003-FR-016, PRIV-011, ACC-003 |

Each component test runs an automated accessibility scan for the rendered state and checks accessible name, description, role, focus order, and keyboard activation where meaningful.

## 8. Integration and failure tests

### 8.1 Browser-resource lifecycle

| Test ID | Injected condition | Expected recovery | Requirement coverage |
|---|---|---|---|
| INT-MEDIA-001 | Permission denied | Preserve setup; state not granted; continue without device | ERR-001 |
| INT-MEDIA-002 | Permission promise remains pending until test timeout | Explain pending/close guidance; no repeated request; limited path remains | NFR-005 |
| INT-MEDIA-003 | Over-constrained/no matching device | Relax once; name type; refresh or continue | ERR-002 |
| INT-MEDIA-004 | `NotReadableError`/device busy | Stop partial tracks; retry or continue; no loop | ERR-003 |
| INT-MEDIA-005 | Track ends/device changes during answer | Preserve timer/text; partial metrics; announce once; reconnect later | ERR-004 |
| INT-MEDIA-006 | Route leave, teardown, page hide, render error | Stop tracks, nodes, recognition, recorder, URLs, worker sampling | FR-021, ERR-014 |
| INT-AUD-001 | AudioContext starts suspended | One user-activated resume, then timing-only fallback | ERR-006 |
| INT-REC-001 | Recorder unsupported/MIME rejection/error/zero byte | No saved recording; other flow preserved | ERR-008 |
| INT-VID-001 | Model 404/init failure/inference rejection | Stop analysis, optionally retain preview, mark unavailable, continue | ERR-005 |
| INT-VID-002 | Worker crash/backlog | Restart once between questions or mark partial/unavailable | ERR-012 |
| INT-TX-001 | Speech unsupported/denied/no-match/network/service error | Preserve final text, manual edit, report completion | ERR-007 |

### 8.2 Storage and export

| Test ID | Injected condition | Expected recovery | Requirement coverage |
|---|---|---|---|
| INT-DB-001 | IndexedDB unavailable/open blocked | Explain and offer ephemeral mode | ERR-009 |
| INT-DB-002 | Transaction abort/quota exceeded during response save | Keep in-memory response; no false success; export/delete options | ERR-009 |
| INT-DB-003 | Quota exceeded during post-review recording save | Keep transient blob while page is active; retry/delete/discard; session intact | ERR-009, FR-048 |
| INT-DB-004 | Corrupt response but valid session | Isolate response; metadata/recovery available; no auto-delete | ERR-010 |
| INT-DB-005 | Unsupported future version | Read-only recovery/export where safe | FR-050, ERR-010 |
| INT-EXP-001 | Blob/URL/print construction failure | Session intact; retry/alternate/copy; partial URL revoked | ERR-011 |
| INT-DEL-001 | Delete transaction fails | UI reports failure and re-reads storage; data is not shown as deleted | FR-033 |

### 8.3 Provider and rendering

| Test ID | Injected condition | Expected recovery | Requirement coverage |
|---|---|---|---|
| INT-PROV-001 | Local question provider throws | Safe built-in fallback; setup preserved | ERR-013 |
| INT-PROV-002 | Transcription/analyzer fake rejects | Reviewed text remains; timing-only/manual path; no overwrite | ERR-013 |
| INT-PROV-003 | Job import/company research fake rejects or returns malformed/blocked result | URL and setup preserved; paste-description fallback; local question generation still available; no private data sent | ERR-013, PRIV-011 |
| INT-UI-001 | Route component throws while media active | Privacy-safe code, recovery actions, global resource stop | ERR-014 |

## 9. End-to-end user journeys

| Test ID | Journey | Required assertions |
|---|---|---|
| E2E-001 | First visit → education → setup → neither device → manual answer → report | No prompt; complete supported path; content feedback after review; visual/audio `Not available`; local save optional |
| E2E-002 | Setup → microphone only → no speech recognition → typed transcript → audio conditions → report | Audio metrics present; video absent; manual alternative complete |
| E2E-003 | Camera only → local video analysis → timing-only report | Worker/local assets only; no content claim; audio/transcript unavailable |
| E2E-004 | Camera + mic → recording enabled → review → discard | No recording in IndexedDB; metrics/session may save; resources stop |
| E2E-005 | Camera + mic → recording enabled → explicit post-review save → delete recording | Blob appears only after save; scoped delete leaves response; URL revoked |
| E2E-006 | Browser speech disclosure → opt in → partial error → edit → review → analysis | Partial text preserved; correction used; raw metadata separate |
| E2E-007 | Flexible, strict, and untimed interview runs | Correct warnings/extensions/no hard stop; sparse announcements |
| E2E-008 | Retry response → choose display attempt → export report | Both attempts retained; chosen attempt explicit; no “best”; exports validate |
| E2E-009 | Save incomplete session → reload → safe resume | No automatic media/timer; completed responses and next index restored |
| E2E-010 | Saved-session search/filter/notes/delete | Filters compose; notes scope/export choice; exact cascade |
| E2E-011 | Seeded Fairness Lab demo with all devices blocked | Loads without prompt; four synthetic trials; exact statement; separate tables; export limitations |
| E2E-012 | User-created Fairness trials with similar/different transcripts | Correct components/bands; no invariance claim when any pair fails |
| E2E-013 | IndexedDB unavailable → ephemeral practice → text export | Useful flow completes; honest persistence status; no false saved state |
| E2E-014 | MediaPipe/worker fails mid-answer | Interview completes; video partial/unavailable; content unchanged |
| E2E-015 | Global Stop and unexpected route error during full capture | Every media/worker/URL resource stops; privacy-safe recovery |
| E2E-016 | Settings change after saved session | New defaults apply only to future sessions; old snapshot unchanged |
| E2E-017 | Load and remove demo alongside user sessions | User records never overwritten/deleted |
| E2E-018 | All-data delete | Two-step confirmation; stores cleared; accurate result; no network |
| E2E-019 | M08.3 setup with job URL/company fields and no configured provider | No network request while typing; explicit research shows consent; sticky nav remains visible and does not cover focus targets; local question generation still works |

## 10. Privacy and responsible-AI verification

### 10.1 Network audit

Run with camera, microphone, recording, speech-declined/manual transcript, analysis, storage, report, and Fairness Lab active.

| Test ID | Assertion |
|---|---|
| PRIVTEST-001 | After same-origin app/model/WASM assets load, no application-data request contains a frame, audio, transcript, résumé, job description, notes, metrics, recording, device label, or capability fingerprint. |
| PRIVTEST-002 | No third-party runtime origin is contacted. Browser speech is tested separately because its vendor-controlled traffic may not be attributable/observable to the page; the UI disclosure remains mandatory. |
| PRIVTEST-003 | Model and WASM load lazily from same origin only after the user enables video analysis. |
| PRIVTEST-004 | Production has no analytics, cookies, tracking, service worker telemetry, session replay, or remote error reporting. |
| PRIVTEST-010 | M08.3 research consent payload contains only company name, company website URL, job title, job posting URL, and request metadata; it excludes resume, answers, recordings, notes, transcripts, camera/microphone data, saved sessions, local paths, and provider secrets. |

### 10.2 Runtime and persistence audit

| Test ID | Assertion |
|---|---|
| PRIVTEST-005 | Inspect React/app state, IndexedDB, exported JSON/text, logs, errors, and worker-to-main results: no raw frame/image, landmark, blendshape, matrix, or PCM data exists. Confirm main-to-worker transferable frames are transient, closed, and absent from diagnostics/persistence. |
| PRIVTEST-006 | A transient recording is absent from IndexedDB until the explicit post-review save event. |
| PRIVTEST-007 | Diagnostics contain event codes/technical states only, never user text, device labels, Blob content, or biometric-derived raw data. |
| PRIVTEST-008 | Device stop indicators disappear and every resource registry entry is closed on all exits/errors. |
| PRIVTEST-009 | Capability data is not assigned a persistent fingerprint or sent anywhere. |

### 10.3 Ethical boundary mutation tests

| Test ID | Mutation | Expected failure |
|---|---|---|
| ETHICS-001 | Add `VideoMetrics` parameter/import to content analyzer | Type/architecture CI fails |
| ETHICS-002 | Add overall score field to a report fixture | Schema/policy CI fails |
| ETHICS-003 | Add emotion, honesty, confidence, personality, employability, or competence output | Prohibited-feature/copy CI fails |
| ETHICS-004 | Persist worker landmark payload | Runtime schema/persistence guard fails |
| ETHICS-005 | Join content rating and video metric in a comparison row/chart | Component structure/policy test fails |
| ETHICS-006 | Analyze an unreviewed automatic transcript | Domain invariant and UI test fail |
| ETHICS-007 | Auto-save a completed recording | Repository interaction test fails |
| ETHICS-008 | Remove the report/comparison limitation | Golden/export test fails |
| ETHICS-009 | Label multiple faces as cheating/suspicious | Prohibited-language test fails |
| ETHICS-010 | Enable backlighting conclusion before QA flag | Feature-flag/config test fails |

## 11. Accessibility test protocol

### 11.1 Automated checks

For every principal page and these states—empty, loading, ready, active, partial, error, complete, dialog open, high contrast—verify:

- zero serious/critical `axe-core` violations;
- one `<main>` and one page `<h1>`;
- unique accessible names and valid descriptions;
- form error association and error-summary focus/links;
- visible focus and no keyboard trap;
- live regions absent from rapidly changing numeric meters;
- table headers/captions and adjacent text alternatives;
- status not represented by color alone;
- target sizes meet product criteria;
- `aria-hidden` duplicates are not focusable.

### 11.2 Manual keyboard script

1. Load each route and use the skip link.
2. Traverse all controls with Tab and Shift+Tab; operate with Enter/Space; close with Escape where applicable.
3. Complete setup, permission fallback, interview, transcript review, report export, saved-session deletion, settings, and Fairness Lab without a pointer.
4. Confirm focus moves to page headings, dialog headings, error summaries, and state headings only at meaningful transitions.
5. Confirm focus returns to the invoker after a dialog and is not obscured by sticky controls.
6. Confirm no timer tick, animated meter, preview, chart, drag action, or hover state is required.

### 11.3 Assistive-technology matrix

| Test ID | Combination | Flows |
|---|---|---|
| A11Y-MAN-001 | NVDA + Chrome | Setup/limited mode, full manual interview, report/export, Fairness demo |
| A11Y-MAN-002 | NVDA + Firefox | Same core flows; capability differences recorded |
| A11Y-MAN-003 | VoiceOver + Safari macOS | Same core flows plus permission dialogs/manual fallback |
| A11Y-MAN-004 | Keyboard only + Windows forced colors | All routes and destructive dialogs |
| A11Y-MAN-005 | 200% zoom and 320 CSS px | All core flows, tables with labeled local scrolling only |
| A11Y-MAN-006 | Reduced motion and timer announcements silenced | Interview and media meters |

Record:

- exact browser/AT/OS versions;
- spoken label/state/error text;
- focus start/end;
- whether an equivalent nonvisual path exists;
- issue severity, workaround, owner, and remediation date.

### 11.4 Timing and cognitive-load checks

- Untimed mode is fully functional.
- Strict mode is explicit, warns at documented points, and offers one-action extension.
- No per-second live-region announcement occurs.
- Live coaching, self-preview, visual meters, and timer announcements are independently disabled.
- There is one clear primary action per interview state and no sudden audio.
- Movement, silence, camera-off, and detection difference are never described as failure or misconduct.

## 12. MediaPipe, camera, microphone, and speech manual matrix

Use synthetic fixtures for conformance. Use real devices only to confirm integration and clearly label observations as browser/device-dependent.

| Test ID | Condition | Verify |
|---|---|---|
| MEDIA-MAN-001 | Camera grant/deny/dismiss/revoke | Accurate state, no data loss, optional path, track cleanup |
| MEDIA-MAN-002 | No camera, no mic, camera only, mic only, both | All four paths reach Ready/Complete |
| MEDIA-MAN-003 | Device switch and unplug mid-answer | Old resource stops; partial metrics; one announcement |
| MEDIA-MAN-004 | Multiple cameras/mics before/after permission | Default works before labels; list refreshes after |
| MEDIA-MAN-005 | Quiet/noisy room, silence, clipping, different microphones | Approximate audio metrics and limitations; no trait label |
| MEDIA-MAN-006 | No face, one face, multiple faces, partial framing | Neutral condition states and continuation |
| MEDIA-MAN-007 | Center/side, near/far, camera below monitor, natural glance | Approximate condition bands; no “good/bad eye contact” |
| MEDIA-MAN-008 | Bright/dim/backlit, varied skin tone and background | Coverage/uncertainty; gated backlight conclusion remains off until approved |
| MEDIA-MAN-009 | Glasses, head covering, assistive device, varied movement | No personal-failure wording; detection limitation acknowledged |
| MEDIA-MAN-010 | Slow CPU/worker crash/model failure | Controls responsive; dropped counts; partial/unavailable fallback |
| MEDIA-MAN-011 | Recorder MIME candidates and resource failure | Observed format, transient review, no false saved state |
| MEDIA-MAN-012 | Speech supported/unsupported/declined/service error | Accurate disclosure/state; manual and timing-only fallback |

Do not retain real-device recordings, frames, transcripts, or identifying QA notes unless a separate approved research protocol exists. The MVP test plan does not authorize such collection.

## 13. Storage, corruption, and eviction checklist

- Open and use the app in normal and private modes; document observed persistence without promising behavior.
- Simulate/open-blocked, unavailable, transaction abort, quota exceeded, and cleared-site-data cases.
- Fill optional recording storage toward the soft limit; confirm the estimate is labeled approximate.
- Confirm active in-memory work remains exportable after a failed commit.
- Upgrade databases from every supported version.
- Inject one corrupt record into each store; confirm isolation and safe metadata/export where possible.
- Inject a future schema version; confirm read-only recovery rather than destructive migration.
- Delete every supported scope and independently inspect stores afterward.
- Confirm resetting settings does not delete sessions, and data deletion describes whether accessibility preferences are included.

## 14. Print and export checklist

For report and Fairness comparison:

- print in Chrome, Edge, Firefox, and Safari;
- black-on-white, no color dependency, no clipped headings/tables, no interactive-only controls;
- full transcripts and relevant disclosures expand;
- page breaks do not separate a heading from the first row/content where practical;
- metadata, schema/algorithm version, generation date, and limitations appear;
- required fairness statement appears exactly when applicable;
- plain text is readable without layout;
- JSON passes the published schema;
- recordings are absent;
- sensitivity preview matches actual output field-for-field;
- failed generation leaves session data intact and revokes partial object URLs.

## 15. Performance and resilience

### 15.1 Budgets and checks

| Test ID | Budget/check |
|---|---|
| PERF-001 | Median input/control response remains below 100 ms and no task attributable to FairScreen media analysis blocks the main thread for 200 ms in the reference profile. |
| PERF-002 | MediaPipe target is 8 fps, configurable 5–10; queue depth is one; stale frames drop rather than accumulate. |
| PERF-003 | Route shell and camera-free workflow do not load MediaPipe model/WASM. |
| PERF-004 | Repeated start/stop cycles do not grow active tracks, AudioContexts, workers, timers, or object URLs. |
| PERF-005 | Long sessions respect recording soft limits and preserve non-recording functions when memory/resource errors occur. |
| PERF-006 | Static core flow works with network disabled after same-origin assets load, except a separately opted browser speech service. |

### 15.2 Reference stress scenarios

- 10-question session with maximum configured prep/answer duration.
- 20 repeated capture start/stop cycles.
- Worker deliberately slower than capture producer.
- 50 saved sessions with multiple responses and retries.
- Storage near soft limit plus a recording save.
- Route error during simultaneous camera, microphone, recorder, worker, and speech use.

## 16. Traceability matrix

The detailed test IDs above are the canonical evidence. This index ensures no requirement group is omitted.

| Requirements | Primary tests | Manual/release evidence |
|---|---|---|
| FR-001–FR-002 | COMP-001, STATIC-005, E2E-001 | A11Y-MAN-001–003, copy review |
| FR-003–FR-012 | COMP-002–006, INT-MEDIA-001–006 | MEDIA-MAN-001–004 |
| FR-013–FR-016 | UNIT-Q-001–006 | Catalogue editorial review |
| FR-017–FR-021 | UNIT-DOM-003–004, COMP-007–008, E2E-007, INT-MEDIA-006 | A11Y timing/keyboard scripts |
| FR-022 | UNIT-AUD-001–007, E2E-002 | MEDIA-MAN-005 |
| FR-023–FR-024 | UNIT-VID-001–008, STATIC-003, ETHICS-001 | MEDIA-MAN-006–010 |
| FR-025–FR-026 | UNIT-TX-001–003, COMP-009, E2E-006 | MEDIA-MAN-012 |
| FR-027–FR-029 | UNIT-AN-001–007, STATIC-004–005, ETHICS-002–003 | Feedback copy review |
| FR-030–FR-037 | UNIT-DOM-002, UNIT-DB-002/004, COMP-010–015, E2E-008–010/016 | Print, storage, AT checklists |
| FR-038–FR-045 | UNIT-FAIR-001–007, COMP-017–020, E2E-011–012/017 | Fairness review |
| FR-046–FR-047 | UNIT-Q-007, STATIC-007, INT-PROV-001–002 | Bundle/source audit |
| FR-048–FR-050 | UNIT-DB-001/003/005, COMP-016, INT-DB-001–005, E2E-004–005/013 | Storage checklist |
| NFR-001–NFR-014 | STATIC-001–012, performance tests, complete browser matrix | Release build/network/deployment review |
| PRIV-001–PRIV-017 | PRIVTEST-001–009, ETHICS-001–010, STATIC-005–011 | Full privacy audit |
| ACC-001–ACC-020 | COMP-001–022 plus automated accessibility on every state | A11Y-MAN-001–006 and timing checks |
| ERR-001–ERR-004 | INT-MEDIA-001–005 | MEDIA-MAN-001–004 |
| ERR-005–ERR-008 | INT-VID-001, INT-AUD-001, INT-REC-001, INT-TX-001 | MEDIA-MAN-005–012 |
| ERR-009–ERR-011 | INT-DB-001–005, INT-DEL-001, INT-EXP-001 | Storage/export checklists |
| ERR-012–ERR-014 | INT-VID-002, INT-PROV-001–002, INT-UI-001 | Stress and recovery run |

### 16.1 Acceptance-criterion evidence index

Each PRD requirement has one acceptance criterion (`AC-<requirement ID>`). This table maps each criterion to its minimum evidence. A test can cover additional behavior; these are the release-gating anchors.

| Acceptance criterion | Minimum evidence |
|---|---|
| AC-FR-001 | COMP-001, E2E-001 |
| AC-FR-002 | COMP-001, STATIC-005, ETHICS-003 |
| AC-FR-003 | COMP-002 |
| AC-FR-004 | COMP-002, UNIT-DOM-002 |
| AC-FR-005 | COMP-003 |
| AC-FR-006 | COMP-004, INT-MEDIA-001–002 |
| AC-FR-007 | COMP-005, MEDIA-MAN-004 |
| AC-FR-008 | COMP-005, INT-AUD-001 |
| AC-FR-009 | COMP-004, E2E-001–003 |
| AC-FR-010 | COMP-006, UNIT-VID-001–005 |
| AC-FR-011 | COMP-004, E2E-013 |
| AC-FR-012 | COMP-003 |
| AC-FR-013 | UNIT-Q-001–002 |
| AC-FR-014 | UNIT-Q-003 |
| AC-FR-015 | UNIT-Q-004–005 |
| AC-FR-016 | UNIT-Q-006 |
| AC-FR-017 | UNIT-DOM-003, COMP-007 |
| AC-FR-018 | UNIT-DOM-004, E2E-007 |
| AC-FR-019 | COMP-007, E2E-007 |
| AC-FR-020 | COMP-008, COMP-022 |
| AC-FR-021 | INT-MEDIA-006, PRIVTEST-008, PERF-004 |
| AC-FR-022 | UNIT-AUD-001–007 |
| AC-FR-023 | UNIT-VID-001–007, INT-VID-001–002 |
| AC-FR-024 | STATIC-003, UNIT-VID-008, ETHICS-001 |
| AC-FR-025 | UNIT-TX-001/003, COMP-009, E2E-006 |
| AC-FR-026 | UNIT-TX-002, COMP-009, ETHICS-006 |
| AC-FR-027 | UNIT-AN-001/003/006 |
| AC-FR-028 | UNIT-AN-002/004/007 |
| AC-FR-029 | STATIC-004–005, ETHICS-002–003 |
| AC-FR-030 | COMP-010, UNIT-EXP-004/006 |
| AC-FR-031 | UNIT-DOM-006, COMP-011, E2E-008 |
| AC-FR-032 | UNIT-EXP-001–004/006, INT-EXP-001 |
| AC-FR-033 | UNIT-DB-002, COMP-013, INT-DEL-001 |
| AC-FR-034 | UNIT-DB-004, COMP-014, E2E-010 |
| AC-FR-035 | UNIT-DOM-005, E2E-009 |
| AC-FR-036 | UNIT-DOM-002, COMP-015, E2E-016 |
| AC-FR-037 | COMP-013/015, E2E-018 |
| AC-FR-038 | COMP-017 |
| AC-FR-039 | COMP-018, ETHICS-005 |
| AC-FR-040 | UNIT-FAIR-001–005, E2E-012 |
| AC-FR-041 | UNIT-FAIR-006, COMP-018, UNIT-EXP-004 |
| AC-FR-042 | UNIT-FAIR-007, COMP-019, E2E-011 |
| AC-FR-043 | UNIT-EXP-004–005, E2E-011–012 |
| AC-FR-044 | COMP-020, E2E-010 |
| AC-FR-045 | UNIT-DB-003, COMP-019, E2E-017 |
| AC-FR-046 | UNIT-Q-007, INT-PROV-001–002 |
| AC-FR-047 | STATIC-007 |
| AC-FR-048 | COMP-016, E2E-004–005, PRIVTEST-006, ETHICS-007 |
| AC-FR-049 | COMP-016, INT-DB-003, PERF-005 |
| AC-FR-050 | UNIT-DB-001/005, UNIT-EXP-002, INT-DB-004–005 |
| AC-NFR-001 | E2E-001, PERF-006, M15 clean static-build check |
| AC-NFR-002 | STATIC-001 |
| AC-NFR-003 | UNIT-VID-006, PERF-001–002 |
| AC-NFR-004 | A11Y-MAN-005, viewport matrix |
| AC-NFR-005 | STATIC-009, INT-MEDIA-001–006, INT-AUD-001, INT-REC-001, INT-VID-001–002, INT-TX-001, INT-DB-001–005, INT-EXP-001 |
| AC-NFR-006 | UNIT-DOM-004, UNIT-Q-004, UNIT-AN-005, UNIT-FAIR-001–007 |
| AC-NFR-007 | STATIC-005, UNIT-AN-007, copy review |
| AC-NFR-008 | STATIC-006, PRIVTEST-002–004/006 |
| AC-NFR-009 | STATIC-011, M15 header/HTTPS/MIME check |
| AC-NFR-010 | STATIC-002/010 |
| AC-NFR-011 | Complete dated browser release matrix |
| AC-NFR-012 | STATIC-006, PRIVTEST-004/007 |
| AC-NFR-013 | STATIC-012, final documentation audit |
| AC-NFR-014 | UNIT-EXP-004–006, print/export checklist |
| AC-PRIV-001 | COMP-004, INT-MEDIA-001–002 |
| AC-PRIV-002 | PRIVTEST-001 |
| AC-PRIV-003 | STATIC-011, PRIVTEST-003 |
| AC-PRIV-004 | STATIC-008, PRIVTEST-005 |
| AC-PRIV-005 | STATIC-008, UNIT-VID-007, PRIVTEST-005, ETHICS-004 |
| AC-PRIV-006 | UNIT-AUD-007, PRIVTEST-005 |
| AC-PRIV-007 | COMP-009, MEDIA-MAN-012 |
| AC-PRIV-008 | COMP-016, PRIVTEST-006, ETHICS-007 |
| AC-PRIV-009 | UNIT-DB-001–005, storage/eviction checklist |
| AC-PRIV-010 | UNIT-DB-002, E2E-018 |
| AC-PRIV-011 | STATIC-006, PRIVTEST-004/009 |
| AC-PRIV-012 | UNIT-EXP-003, COMP-012 |
| AC-PRIV-013 | STATIC-003–005, ETHICS-001–003/005/009 |
| AC-PRIV-014 | PRIVTEST-007, INT-UI-001 |
| AC-PRIV-015 | INT-MEDIA-006, PRIVTEST-008 |
| AC-PRIV-016 | STATIC-011, PRIVTEST-002–003 |
| AC-PRIV-017 | INT-DB-001–003, storage/eviction checklist |
| AC-ACC-001 | Automated axe checks on all specified states; A11Y-MAN-001–006 |
| AC-ACC-002 | Manual keyboard script; A11Y-MAN-004 |
| AC-ACC-003 | COMP-001–022 focus assertions; manual keyboard script |
| AC-ACC-004 | COMP-002, COMP-013 |
| AC-ACC-005 | COMP-021 |
| AC-ACC-006 | UNIT-DOM-004, E2E-007 |
| AC-ACC-007 | COMP-021, A11Y-MAN-006 |
| AC-ACC-008 | A11Y-MAN-006, reduced-motion browser checks |
| AC-ACC-009 | A11Y-MAN-004–005, measured-token review |
| AC-ACC-010 | A11Y-MAN-005, viewport/text-spacing matrix |
| AC-ACC-011 | COMP-022, forced-colors check |
| AC-ACC-012 | UNIT-TX-003, E2E-001–002 |
| AC-ACC-013 | E2E-001/011 |
| AC-ACC-014 | E2E-001/003 |
| AC-ACC-015 | COMP-008/022, A11Y-MAN-006 |
| AC-ACC-016 | E2E-001/007, cognitive-load checks |
| AC-ACC-017 | STATIC-005, MEDIA-MAN-006–009, ETHICS-009 |
| AC-ACC-018 | COMP-018/022 |
| AC-ACC-019 | Automated target-size checks; manual keyboard/pointer inspection |
| AC-ACC-020 | A11Y-MAN-001–006 |
| AC-ERR-001 | INT-MEDIA-001 |
| AC-ERR-002 | INT-MEDIA-003 |
| AC-ERR-003 | INT-MEDIA-004 |
| AC-ERR-004 | INT-MEDIA-005 |
| AC-ERR-005 | INT-VID-001 |
| AC-ERR-006 | INT-AUD-001 |
| AC-ERR-007 | INT-TX-001 |
| AC-ERR-008 | INT-REC-001 |
| AC-ERR-009 | INT-DB-001–003 |
| AC-ERR-010 | INT-DB-004–005 |
| AC-ERR-011 | INT-EXP-001 |
| AC-ERR-012 | INT-VID-002 |
| AC-ERR-013 | INT-PROV-001–002 |
| AC-ERR-014 | INT-UI-001 |

## 17. Defect severity and release rules

| Severity | Definition | Release rule |
|---|---|---|
| S0 — Boundary violation | Data egress, secret exposure, prohibited inference/scoring, raw biometric/audio persistence, unreviewed transcript analysis, or visual influence on content | Immediate stop; cannot waive for MVP |
| S1 — Critical | Data loss, device left active, destructive wrong-scope deletion, inaccessible core flow, false save/success, or unrecoverable crash | Must fix before release |
| S2 — Major | Core path/fallback unavailable, materially wrong metric/export, serious accessibility issue, or supported-browser failure | Must fix or remove support/feature before release |
| S3 — Moderate | Workaround exists; non-core usability/accessibility degradation | Fix or document with owner/date after explicit review |
| S4 — Minor | Cosmetic/documentation issue without misleading effect | May defer with tracked owner |

No waiver can authorize an S0 issue. An S1/S2 exception requires removal/disablement of the affected feature or a new decision-log entry signed by product, privacy/responsible-AI, accessibility where relevant, and release owner.

## 18. Release evidence package

Store with the release tag:

- requirement-to-test report;
- exact automated command results and commit identifier;
- browser/OS/device capability matrix with dates;
- accessibility manual results;
- network and IndexedDB audit results;
- production bundle/asset inventory and licenses;
- measurement golden-fixture versions;
- schema/config/algorithm versions;
- unresolved defects and approved exceptions;
- privacy, responsible-AI, accessibility, and release-owner sign-offs.

## 19. Final manual release checklist

- [ ] All automated suites pass from a clean install.
- [ ] Every requirement has linked evidence.
- [ ] Camera-free, microphone-free, manual-transcript, timing-only, and seeded-demo flows pass.
- [ ] Device prompts are just in time and all resources stop.
- [ ] No user-data egress or third-party runtime origin appears.
- [ ] No prohibited inference, combined score, or content/video coupling exists.
- [ ] No raw frame/landmark/matrix/blendshape/PCM or unconfirmed recording persists.
- [ ] MediaPipe is lazy, same-origin, worker-based, responsive, and failure-tolerant.
- [ ] M08.3 provider-backed job posting import and company research are manually
      checked with consent, blocked/offline/error cases, source attribution,
      include/exclude/delete, no client secrets, and no private practice-data
      egress.
- [ ] Automatic text cannot be analyzed until reviewed.
- [ ] Reports/exports are separate, complete, schema-valid, recording-free, and carry limitations.
- [ ] Storage failures/corruption/eviction cases are honest and recoverable.
- [ ] Assistive-technology, keyboard, contrast, reflow, motion, and timing checks pass.
- [ ] Supported browser/version statements match recorded results.
- [ ] Licenses, dependency audit, headers, HTTPS, and host behavior are reviewed.
- [ ] Decision log and all specification documents match the release.
