# FairScreen Product Requirements Document

**Version:** 1.0  
**Status:** Approved for milestone implementation  
**Research baseline:** 2026-07-28  
**Normative language:** **Must** and **shall** are release requirements. **Should** is expected unless an implementation constraint is documented. **May** is optional.

## 1. Product definition

FairScreen is a single-user, local-first interview practice and fairness-auditing web application. It conducts mock automated interviews, analyzes reviewed transcript content with deterministic heuristics, describes observable audio/video-call conditions without psychological inference, and lets users compare similar answers in a central Fairness Lab.

FairScreen is coaching software, not selection software. It has no employer, recruiter, assessor, proctor, administrator, team, or candidate-ranking role.

## 2. Release objective

Release 1 shall prove that useful interview coaching can coexist with:

- no overall suitability or employability score;
- no inferred emotion, honesty, confidence, personality, intent, or enthusiasm;
- strict separation between answer content and video conditions;
- camera-free and microphone-free completion paths;
- local browser processing and storage;
- explicit, reversible consent for optional media and recording;
- deterministic, testable language analysis; and
- a seeded fairness demonstration requiring no permission.

## 3. Scope

### 3.1 In scope

- Public education and privacy pages.
- Local interview context, résumé text, and job-description entry.
- Configurable question category, difficulty, count, timing, coaching, transcription, and recording preferences.
- Capability and device checks.
- Camera/microphone-optional interview simulation.
- At least 60 built-in English question templates.
- Deterministic question rendering, keyword extraction, duplicate prevention, and seeded selection.
- Explicit interview state machine.
- Local audio and video-condition aggregation where supported.
- Browser speech-recognition attempt only after capability and privacy checks.
- Manual or edited transcript and timing-only fallback.
- Deterministic answer analysis.
- Session and per-question reports.
- Retry, notes, print, text export, and JSON export.
- Fairness Lab recording/comparison workflow and seeded demonstration.
- IndexedDB persistence and deletion controls.
- Accessibility preferences and WCAG 2.2 AA target.
- Automated and manual QA defined in the QA plan.

### 3.2 Out of scope for release 1

- User accounts, login, server storage, multi-device synchronization, collaboration, coach review, or sharing links.
- A production AI/LLM provider.
- Cloud transcription supplied by FairScreen.
- Languages other than English for deterministic content analysis.
- Native iOS or Android apps.
- Automated PDF creation; the browser print workflow may create PDF.
- Offline/PWA installation guarantees.
- Formal accessibility, privacy, legal, or security certification.

### 3.3 Prohibited at every release

- Employer-facing candidate screening, ranking, recommendation, or batch processing.
- Emotion, honesty, deception, confidence, enthusiasm, personality, culture, disability, demographic, or employability inference.
- Face recognition, identity verification, remote biometric identification, or biometric categorization.
- Eye tracking presented as actual gaze or “eye contact.”
- Eye redirection or video alteration.
- Virtual-camera output, prerecorded response injection, or interview-platform automation.
- Hidden real-time answer generation or third-party interview assistance.
- Background capture or recording.
- Automatic recording retention.
- A composite score that mixes content, speech, audio, video, or hardware observations.
- Claims that webcam behaviour predicts competence or job performance.

## 4. User roles

| Role | Capabilities | Exclusions |
| --- | --- | --- |
| **Practicing applicant** | Configures, conducts, reviews, compares, exports, and deletes their own local practice data. | Cannot submit to or be ranked for an employer. |
| **Demo visitor** | Reads educational content and explores seeded Fairness Lab data without permissions or persistence unless they choose to load demo data. | No camera or microphone required. |
| **Developer/tester** | Uses documented demo modes, dependency injection, mocks, and deterministic seeds to verify the app. | No hidden production admin panel and no access to another person's data. |

There is deliberately no privileged runtime role.

## 5. Core user journeys

1. **Camera-free practice:** Landing → New interview → Enter context → Choose no media/manual transcript → Practice → Edit transcript → Review content coaching → Save/export/delete.
2. **Full local practice:** Landing → New interview → Configure → Explain and request devices → Check preview/levels → Practice → Review media → Approve transcript → Analyze → Report.
3. **Fairness comparison:** Fairness Lab → Learn comparison purpose → Choose seeded demo or create group → Record/reuse materially similar answers under labeled conditions → Review each transcript → Compare separate content and video panels → Export.
4. **Recovery:** Saved sessions → Filter incomplete → Resume at a safe state → reacquire optional devices → continue or close session.
5. **Privacy control:** Settings/Data → inspect approximate local usage → delete one recording/session or all data → confirm → receive completion result.

## 6. User stories

| ID | User story | Primary requirement links |
| --- | --- | --- |
| US-001 | As an applicant, I want to practice without granting camera access so that the tool remains useful and private. | FR-009, ACC-013, PRIV-001 |
| US-002 | As an applicant, I want relevant questions based on a job posting so that practice resembles the role. | FR-003, FR-013–FR-016 |
| US-003 | As an applicant, I want adjustable or disabled timing so that I can practice at a manageable pace. | FR-018, ACC-006–ACC-007 |
| US-004 | As a keyboard user, I want every interview action to work without a pointer. | ACC-002–ACC-005 |
| US-005 | As a screen-reader user, I want concise state and timer announcements without a message every second. | ACC-005, ACC-007 |
| US-006 | As an anxious applicant, I want to disable live prompts and hide my self-preview during an answer. | FR-020, ACC-015–ACC-016 |
| US-007 | As an applicant with disability-related movement or gaze differences, I want condition observations to remain neutral and never lower content feedback. | FR-024, ACC-017, PRIV-013 |
| US-008 | As an applicant, I want to correct a transcript before it is analyzed so that recognition errors do not become feedback. | FR-025–FR-028 |
| US-009 | As an applicant, I want suggestions tied to my words so that I can understand and challenge the analysis. | FR-027–FR-029 |
| US-010 | As a privacy-conscious user, I want recordings off by default and saved only when I choose. | FR-048, PRIV-008 |
| US-011 | As a user on a shared device, I want clear deletion and export controls. | FR-033, FR-037, PRIV-009–PRIV-012 |
| US-012 | As a visitor, I want to understand the fairness problem without granting device permission. | FR-001–FR-002, FR-042 |
| US-013 | As a user, I want to compare the same answer under different camera conditions without receiving a competence conclusion. | FR-038–FR-043 |
| US-014 | As a user whose browser lacks an optional API, I want a precise fallback rather than a generic failure. | FR-012, NFR-005, ERR-001–ERR-013 |
| US-015 | As a portfolio reviewer, I want inspectable architecture and tests that enforce the ethical boundary. | NFR-002, NFR-006, NFR-010, NFR-013 |

## 7. Functional requirements

### 7.1 Education, setup, and capabilities

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| **FR-001** | The landing experience shall explain the product, intended user, core workflows, and line “Practice the interview. Question the scoring.” | **AC-FR-001:** A first-time visitor can identify interview practice, content coaching, Fairness Lab, local-first handling, and the primary start actions without opening another route. |
| **FR-002** | Education shall distinguish observable conditions from unsupported traits and list prohibited inferences. | **AC-FR-002:** The UI states that gaze/camera/lighting/movement are not reliable measures of competence and never describes FairScreen as detecting emotion, honesty, confidence, personality, or employability. |
| **FR-003** | Setup shall accept job title, company, job description, optional résumé text, category, difficulty, and optional custom questions. | **AC-FR-003:** Required fields are identified; optional fields are marked; entered text survives route navigation and is included in the session snapshot only after the user creates the session. |
| **FR-004** | Setup shall accept question count, preparation time, answer time, timing mode, live-coaching choice, transcription choice, and recording choice. | **AC-FR-004:** Validation prevents negative durations, count outside 1–10, and incompatible choices; defaults come from UserSettings and can be changed for the session without changing global defaults. |
| **FR-005** | The app shall produce a typed browser capability report before optional features are used. | **AC-FR-005:** Report covers secure context, media devices, device enumeration, Web Audio, MediaRecorder and supported MIME candidates, worker, WebAssembly, MediaPipe initialization state, speech recognition, IndexedDB, storage estimate/persistence, and print/export support with `supported`, `limited`, `unsupported`, `blocked`, or `unknown`. |
| **FR-006** | Camera and microphone shall be requested separately or together only after explanatory user action. | **AC-FR-006:** Loading landing/setup does not trigger a device prompt; each request names the benefit and fallback; denial does not clear entered setup data. |
| **FR-007** | Device check shall provide camera preview and input-device selection where available. | **AC-FR-007:** Default device works before labels are available; after permission, selectors refresh; switching device stops the replaced track; preview has hide/show and mirror-display controls that do not alter analysis coordinates. |
| **FR-008** | Device check shall provide a microphone level indicator and input selection where available. | **AC-FR-008:** Meter begins only after a user action, has an equivalent text state, can be stopped, and switching devices releases the old track and audio graph. |
| **FR-009** | Users shall be able to continue with camera only, microphone only, or neither. | **AC-FR-009:** Each combination reaches interview Ready; unavailable measurements are marked `Not available`; manual-answer entry and the seeded Fairness Lab remain available. |
| **FR-010** | Optional camera checks shall cover face presence, approximate centring, framing, brightness, and multi-face presence. | **AC-FR-010:** Results use neutral condition wording, can be skipped, expose uncertainty, do not block continuation, and never mention emotion or identity. |
| **FR-011** | Device check shall explain limited-functionality mode before continuation. | **AC-FR-011:** A summary lists which features will work, which will not, and what fallback will be used; the primary Continue action remains available unless core local storage cannot be initialized, in which case an ephemeral session option is offered. |
| **FR-012** | Capability status shall remain viewable from setup and settings. | **AC-FR-012:** Re-run refreshes transient capability state without requesting permission automatically; support labels match the capability model and have help text. |

Browser facts behind these requirements: media capture requires a secure context and express permission, and a prompt can remain unanswered ([MDN `getUserMedia`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)); device visibility and labels are permission-dependent ([MDN `enumerateDevices`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices)).

**M07.2 setup addendum:** Optional resume context may be imported only from a
local PDF, DOCX, or TXT file. The file is parsed in the browser into plain text
and is not uploaded. Manual resume typing and pasting are not available in the
setup interface. Legacy DOC, unsupported, oversized, empty, corrupt,
password-protected, image-only, and excessive-text files show guidance without
fabricated success. Original files, filenames, bytes, parser objects, and
buffers remain transient; only user-confirmed extracted plain text may enter
`resumeText`. If generated questions already exist, confirming, replacing, or
removing resume text invalidates that snapshot and requires deliberate
regeneration.

### 7.2 Question generation

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| **FR-013** | A local provider shall contain at least 60 reviewed templates across general behavioural, software/technical, customer service, leadership, and investigative banks, plus user-supplied custom questions. | **AC-FR-013:** Automated tests count at least 60 unique built-in IDs, validate required metadata, and detect normalized duplicate prompts. |
| **FR-014** | The provider shall extract non-sensitive role terms from job title, job description, and optional résumé text using deterministic local rules. | **AC-FR-014:** Extraction is local, capped, stop-word filtered, reproducible, and returns source and weight for each keyword; blank inputs return safe defaults. |
| **FR-015** | Question selection shall consider category, difficulty, rendered role terms, and duplicate prevention. | **AC-FR-015:** Given the same input and session seed, order is reproducible; no normalized duplicate appears in one session; if a bank is exhausted, documented fallback questions are used. |
| **FR-016** | Users shall be able to add, edit, remove, reorder, and mix custom questions with generated questions before starting. | **AC-FR-016:** Empty/duplicate custom items are identified; at least one valid question is required; final question snapshots do not change if the source setup text changes later. |

### 7.3 Mock interview

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| **FR-017** | Interview progression shall use the explicit states `ready`, `preparing`, `answering`, `reviewing`, `betweenQuestions`, and `complete`. | **AC-FR-017:** Only transitions in the approved state table are possible; invalid events are ignored and logged without user data; refresh recovery never resumes active capture automatically. |
| **FR-018** | Timing shall support `flexible`, `strictPractice`, and `untimed` modes. | **AC-FR-018:** Users can choose untimed or a wide duration range before interview; flexible mode never hard-stops an answer; strict mode requires explicit opt-in, gives warnings, and provides an accessible extension action. |
| **FR-019** | The interview shall provide start, finish, repeat, skip, end, extend-time, hide-preview, and media-stop controls when relevant. | **AC-FR-019:** Controls are state-appropriate, keyboard-operable, labeled, protected from accidental double activation, and preserve or explicitly discard captured work after confirmation. |
| **FR-020** | Live coaching shall be optional, suppressible at any time, descriptive only, and visually quiet. | **AC-FR-020:** Default is off; prompts concern answer process or call conditions, never inferred traits; disabling it removes new prompts without changing measurements or report results. |
| **FR-021** | Capture resources shall stop on finish, end, navigation, device change, component teardown, page hide where practical, and unrecoverable error. | **AC-FR-021:** Tests verify all MediaStream tracks stop, AudioContext nodes disconnect/close, recognition aborts, recorder finalizes/discards safely, object URLs revoke, and worker sampling stops. |

### 7.4 Measurements and transcription

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| **FR-022** | Audio aggregation shall calculate only the approved timing and level metrics in the Measurement Specification. | **AC-FR-022:** Metrics carry sample count, availability, algorithm version, thresholds, and limitations; no metric is named or used as confidence, enthusiasm, fluency, truthfulness, or competence. |
| **FR-023** | Video aggregation shall calculate only the approved face-presence, centring, near-camera orientation, framing, brightness, and multi-face condition metrics. | **AC-FR-023:** Frame-level landmarks are discarded after aggregation; output includes sampled/dropped counts and failure reasons; MediaPipe failure does not end the interview. |
| **FR-024** | Content analysis and video conditions shall be separated at type, service, persistence, UI, and export boundaries. | **AC-FR-024:** Content analyzer accepts no `VideoMetrics`; its tests run with no video types; changing a video fixture leaves every content-analysis result byte-for-byte unchanged. |
| **FR-025** | Transcription shall follow a graceful hierarchy: supported browser recognition after disclosure, manual/editable transcript, then timing-only feedback. | **AC-FR-025:** Unsupported, declined, interrupted, or failed recognition immediately exposes manual entry; no message implies universal support; timing-only completion remains available. |
| **FR-026** | Automatically produced text shall require review before content analysis. | **AC-FR-026:** Analysis action remains disabled until the user selects “I reviewed this transcript” or chooses manual/timing-only mode; edits create a reviewed text revision without overwriting the transient recognition state during active review. Persistence keeps the reviewed revision and technical provider/error metadata, not a duplicate unreviewed transcript. |

`SpeechRecognition` is explicitly treated as browser-dependent: MDN marks it as limited availability and notes that some browsers use a server-based service that receives audio ([MDN `SpeechRecognition`](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)).

### 7.5 Answer analysis and reports

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| **FR-027** | A deterministic local analyzer shall evaluate question relevance, specificity, example evidence, personal contribution, outcome, measurable evidence, possible STAR structure, repetition, filler language, length, approximate pace, and clarity/concision. | **AC-FR-027:** Each category has a versioned rule, prerequisites, rating, cautious message, evidence spans where applicable, and fixture tests for boundary cases. |
| **FR-028** | Analysis shall use separate category ratings and never invent missing information. | **AC-FR-028:** Allowed ratings are `strong`, `developing`, `needsMoreEvidence`, `notAvailable`, and `notApplicable`; output uses phrases such as “appears to include,” “was not detected,” and “may be incomplete.” |
| **FR-029** | The product shall not generate an overall suitability, employability, confidence, personality, or combined performance score. | **AC-FR-029:** No domain field, copy, chart, route, export, or test fixture contains such a score; a prohibited-language test fails the build for reviewed forbidden phrases. |
| **FR-030** | A report shall provide session overview, per-question transcript and feedback, metrics, detected strengths, suggestions, summary, notes, and limitations. | **AC-FR-030:** Missing metrics render `Not available`; visual conditions are in a separate labeled region after content; the required fairness warning appears on screen and in print/export. |
| **FR-031** | A user shall be able to retry a question without deleting the earlier response. | **AC-FR-031:** Each attempt is separately timestamped and reviewable; the user can designate an attempt for report display; no “best” attempt is chosen by an algorithm. |
| **FR-032** | Reports shall support accessible print, plain-text export, and versioned JSON export. | **AC-FR-032:** Exports are generated locally; filenames are sanitized; recording blobs are excluded; user previews included sensitive context fields; JSON validates against the documented schema version. |
| **FR-033** | A user shall be able to delete a response recording, response, fairness trial, comparison, session, or all application data with scoped confirmation. | **AC-FR-033:** Deletion reports success/failure, cascades only documented dependents, releases object URLs, and updates indexes; destructive all-data action requires typed or two-step confirmation. |

### 7.6 Saved sessions and settings

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| **FR-034** | Saved sessions shall support search, sort, and filters for status, category, date, media mode, and fairness comparisons. | **AC-FR-034:** Search matches job title, company, question text, and user notes but not recording binary; filters compose; empty/no-result states are distinct. |
| **FR-035** | Incomplete sessions shall be resumable from a safe non-capturing state. | **AC-FR-035:** Resume restores questions, settings snapshot, completed responses, and next index; it never restores an active stream or timer; missing optional devices trigger setup fallback. |
| **FR-036** | Settings shall cover default interview length, prep/answer time, timing mode, live coaching, transcription attempts, recording, reduced motion, high contrast, text size, and privacy/data preferences. | **AC-FR-036:** Settings have documented defaults and valid ranges; session snapshots do not mutate when defaults later change; system reduced-motion/high-contrast preferences are respected until explicitly overridden. |
| **FR-037** | Settings shall provide reset-settings and delete-all-data actions as separate operations. | **AC-FR-037:** Resetting settings does not delete sessions; deleting data does not silently reset accessibility preferences until the confirmation describes that scope; both actions are undo-free and clearly labeled. |

### 7.7 Fairness Lab

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| **FR-038** | Users shall be able to create a Fairness Trial group for the same question and label each attempt's recording condition. | **AC-FR-038:** Required condition labels include near camera, looking at question, side camera, camera below monitor, dim, backlit, partial framing, natural glances, low resolution, and custom; labels are user descriptions, not verified ground truth. |
| **FR-039** | A comparison shall display Answer Content and Video Conditions as independent datasets. | **AC-FR-039:** Content panel appears first, no row joins a content rating to a video metric, no combined visualization exists, and tables remain the canonical accessible representation. |
| **FR-040** | Transcript similarity shall use the approved deterministic normalization and similarity rules. | **AC-FR-040:** Exact, substantially unchanged, similar, and different bands match the Measurement Specification; pairwise results expose component values, word-count difference, and missing-data state. |
| **FR-041** | When content is identical or substantially unchanged, the UI shall display the exact approved invariance statement. | **AC-FR-041:** The message is: “The answer content remained unchanged. Differences in video conditions should not be interpreted as differences in competence.” It appears in screen, print, text, and JSON representations. |
| **FR-042** | The Fairness Lab shall include a seeded, camera-free demonstration with at least four condition trials. | **AC-FR-042:** Demo data is deterministic, clearly labeled synthetic, includes identical transcript content and varied video-condition aggregates, loads without permissions, and can be removed independently. |
| **FR-043** | Fairness comparisons shall support print, plain-text, and JSON export with limitations. | **AC-FR-043:** Export states that the comparison is descriptive, cannot establish causality or model bias from a small sample, and includes no competence conclusion. |

### 7.8 Notes, data, and extension ports

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| **FR-044** | Users shall be able to save private notes at session, response, and comparison level. | **AC-FR-044:** Notes are local, searchable only where specified, omitted from export unless selected, and never parsed for scoring. |
| **FR-045** | Demo data shall be loadable and deletable without overwriting user data. | **AC-FR-045:** Demo IDs are namespaced; repeated load is idempotent; removal deletes only seeded records. |
| **FR-046** | Question generation, transcription, and answer analysis shall be accessed through typed provider interfaces. | **AC-FR-046:** Local implementations can be replaced by test fakes; future remote adapters can be added without changing page components or persisted core models; remote provider is not implemented in MVP. |
| **FR-047** | No secret or provider API key shall be embedded in the client. | **AC-FR-047:** Source and production bundle scans find no configured secrets; environment variables exposed by Vite contain only non-secret public configuration. |
| **FR-048** | Recording shall be off by default and a completed recording shall remain transient until the user chooses “Save recording on this device.” | **AC-FR-048:** Start state visibly indicates recording choice; stop produces in-memory review; leaving review prompts to save or discard; no IndexedDB write occurs before explicit save. |
| **FR-049** | Data controls shall show approximate storage usage and warn when optional recordings approach a configurable soft limit. | **AC-FR-049:** `navigator.storage.estimate()` is used when available and labeled an estimate; absence does not fail storage; quota errors identify deletion/export options. |
| **FR-050** | Persisted data and exports shall be schema-versioned and migratable. | **AC-FR-050:** Database opening runs ordered, idempotent migrations; an unsupported future version opens read-only recovery/export mode; corrupt records are isolated rather than deleting the database. |

## 8. Non-functional requirements

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| **NFR-001** | The MVP shall be a static, client-side application with no application backend. | Build output deploys to static hosting; all core flows work with network requests disabled after same-origin assets load, except an explicitly chosen browser speech service outside FairScreen's control. |
| **NFR-002** | TypeScript strict mode shall be enabled; production source shall not use explicit or implicit `any`. | `tsc --noEmit` passes with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `useUnknownInCatchVariables`; lint forbids explicit `any`. |
| **NFR-003** | Media analysis shall protect UI responsiveness. | MediaPipe runs in a worker; sampling target is 8 fps and configurable 5–10; queue depth is one; stale frames are dropped; interview controls remain responsive under the performance test profile. |
| **NFR-004** | The UI shall support mobile, tablet, and desktop layouts. | Core workflows work at 320 CSS px without horizontal page scrolling, at 200% zoom, in portrait/landscape, and at defined 768/1024 px layout transitions. |
| **NFR-005** | Every optional API shall have feature detection, timeout/failure handling, and a documented fallback. | Capability matrix and automated failure fixtures cover media, recorder, audio, worker/MediaPipe, speech, storage estimate, persistent storage, and export. |
| **NFR-006** | Core selection and analysis shall be deterministic. | Same input, config, seed, and algorithm version produce deep-equal output; clocks, IDs, random source, and browser ports are injectable in tests. |
| **NFR-007** | Application copy shall be plain, cautious, and non-diagnostic. | Copy review passes the safe-language checklist and prohibited-language scan; all approximation messages contain context or limitations. |
| **NFR-008** | Privacy-preserving defaults shall apply. | Media off until chosen, recording off, live coaching off, no analytics, no third-party-hosted runtime code or assets, no automatic persistence of media, and no speech service until disclosed. Audited dependencies are bundled and served from the application origin. |
| **NFR-009** | Production hosting shall use HTTPS and restrictive same-origin policies. | Deployment documents HTTPS, `Content-Security-Policy`, `Permissions-Policy`, referrer policy, MIME correctness for WASM/model assets, and absence of third-party runtime origins. |
| **NFR-010** | The codebase shall use feature-oriented modules and stable domain ports. | Architecture dependency rules pass; pages do not call browser APIs or IndexedDB directly; circular dependency scan passes. |
| **NFR-011** | The core test target shall include current and previous major desktop Chrome, Edge, Firefox, and Safari; mobile browsers are supported through responsive limited mode. | Release matrix records actual results and known limitations; unsupported capability is not represented as a product failure. |
| **NFR-012** | The MVP shall contain no analytics, advertising, tracking pixel, session replay, or remote error-reporting SDK. | Dependency/source/network audit finds none; errors remain in-memory and expose copyable diagnostics only after user action. |
| **NFR-013** | Architecture, heuristics, data lifecycle, limitations, and decisions shall remain documented and versioned. | Repository documentation links the specification version and algorithm versions; changes to a protected boundary require a decision-log entry. |
| **NFR-014** | Print and export output shall be usable without colour or interactive UI. | Print hides navigation/media controls, expands relevant content, includes URLs/metadata and disclaimers, uses black-on-white, and avoids clipped tables. |

## 9. Privacy requirements

Canadian privacy regulators' 2025 biometric guidance emphasizes necessity, proportionality, transparency, safeguards, and accuracy when bodily characteristics are processed ([Office of the Privacy Commissioner of Canada](https://www.priv.gc.ca/en/privacy-topics/health-genetic-and-other-body-information/biometrics/gd_bio_org-final/)). FairScreen does not perform identity recognition, but it treats camera frames, face-derived geometry, voice, transcripts, and recordings as sensitive user data.

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| **PRIV-001** | Permission requests shall be explicit, purpose-specific, and just in time. | No prompt on page load; explanation precedes request; camera/mic can be chosen independently; denial has a complete fallback. |
| **PRIV-002** | FairScreen shall not upload video, audio, frames, landmarks, transcripts, résumé text, job descriptions, metrics, or recordings to an application server. | Network tests with media enabled show only same-origin static asset requests; no application data request is emitted. |
| **PRIV-003** | Face processing shall run locally using same-origin bundled code, WASM, and model assets. | No runtime model/CDN request; model loads only when user enables video analysis; source licenses/attribution are included. |
| **PRIV-004** | Camera frames shall be transient and discarded immediately after the current sample is processed. | No frame/image/canvas serialization enters storage, logs, state snapshots, exports, or error payloads. |
| **PRIV-005** | Raw face landmarks, blendshapes, and transformation matrices shall never be persisted. | Worker emits only approved aggregates/sample summaries; persistence types cannot represent landmarks; a repository write guard rejects unexpected frame-level fields. |
| **PRIV-006** | Raw audio samples shall remain transient unless MediaRecorder is explicitly enabled; analysis stores aggregates only. | PCM/time-domain arrays are reused or released, never serialized, and excluded from diagnostics. |
| **PRIV-007** | Browser speech recognition shall require disclosure that processing may be remote and controlled by the browser/vendor. | Opt-in copy appears before first start; user can choose manual instead; choice and provider mode are recorded without claiming local processing when unknown. |
| **PRIV-008** | Recordings shall require two choices: enable capture before interview and save locally after review. | Neither choice is implied by the other; discard is available; recordings never auto-save. |
| **PRIV-009** | Session data shall remain in origin-scoped IndexedDB and be described as local, best-effort browser storage. | UI does not call it encrypted or guaranteed; private-mode/eviction limitations are explained. |
| **PRIV-010** | Users shall be able to delete individual data and all stored data. | Deletion functions without network, confirms scope, and verifies affected local records are gone. |
| **PRIV-011** | The MVP shall not require analytics, cookies, fingerprinting, or cross-site storage. | No analytics/cookie consent banner is needed; only necessary origin storage is used; capability details are not combined into a persistent fingerprint. |
| **PRIV-012** | Export shall be user-initiated and preceded by a sensitive-content summary. | User sees whether job description, résumé, transcript, notes, metrics, and metadata are included; recordings are never embedded in text/JSON. |
| **PRIV-013** | The system shall not perform identity, emotion, personality, demographic, disability, medical, honesty, or intent inference. | No model/interface supports such outputs; policy and prohibited-language tests run in CI. |
| **PRIV-014** | Logs and errors shall minimize user content. | Production diagnostics use event codes and technical states, not transcript/job/résumé text, device labels, frames, or Blob data. |
| **PRIV-015** | Active capture indicators and stop controls shall be persistent while FairScreen uses a device. | App-level camera/mic/recording states are visible in addition to browser indicators; global Stop media works in all capture states. |
| **PRIV-016** | Runtime dependencies and assets shall be served from the application's origin. | No remote font, icon, script, model, WASM, or analytics origin appears in the production network allowlist. |
| **PRIV-017** | Storage failure and eviction risk shall be disclosed without overstating persistence. | UI notes best-effort default, private-session clearing, browser-dependent quotas, export option, and `QuotaExceededError` recovery. |

IndexedDB can store structured data and blobs, but quota/eviction rules differ by browser and best-effort storage can be removed under storage pressure; private-mode data is normally cleared when the private session ends ([MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [MDN storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)).

## 10. Accessibility requirements

The conformance target is **WCAG 2.2 Level AA** for authored content and flows, documented as a target rather than a certification. Timed interview simulation is not treated as an essential exception. WCAG advises allowing a user to turn off, broadly adjust, or extend content-imposed time limits ([W3C SC 2.2.1](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)); dynamic statuses must be programmatically available without unnecessarily moving focus ([W3C SC 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)).

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| **ACC-001** | The app shall target WCAG 2.2 AA. | Automated scans have no serious/critical violations; manual checklist passes; exceptions are documented with owner and remediation. |
| **ACC-002** | All functions shall be keyboard-operable without traps. | Logical Tab/Shift+Tab order, Enter/Space activation, Escape behaviour, and no pointer-only interaction across every route. |
| **ACC-003** | Focus shall be visible and managed after route/state/dialog changes. | Focus moves to the new page heading or dialog, returns to invoker on close, is not obscured, and is never forced each timer tick. |
| **ACC-004** | Forms and controls shall use semantic elements, labels, descriptions, and grouped errors. | Every input has programmatic name; required/optional and error states are conveyed in text; error summary links to fields. |
| **ACC-005** | Interview state, recording state, save/delete results, and important errors shall be announced. | Polite/assertive live regions are used appropriately; messages do not steal focus; duplicate announcements are suppressed. |
| **ACC-006** | Time limits shall be disableable, broadly adjustable, or extendable. | Untimed mode exists; configured ranges cover at least 10× the shortest default where practical; strict mode warns and offers a one-action extension. |
| **ACC-007** | Timer announcements shall be sparse and controllable. | No per-second screen-reader updates; default announcements occur at state start, 30 seconds, 10 seconds, and expiry/overtime as applicable; user can silence them. |
| **ACC-008** | Reduced motion shall follow system preference and user override. | Non-essential transitions/animated meters are disabled; no essential information depends on motion. |
| **ACC-009** | Default and high-contrast themes shall meet text and non-text contrast requirements. | Measured tokens meet 4.5:1 normal text, 3:1 large text/UI components; forced-colors mode remains operable. |
| **ACC-010** | Content shall support 200% zoom, reflow, text resizing, and spacing overrides. | No loss of content/function and no horizontal page scrolling at 320 CSS px except intrinsically scrollable data tables with labels. |
| **ACC-011** | Status shall not rely on colour alone. | Icons, text labels, shape/border, and accessible names accompany colour. |
| **ACC-012** | Transcript input/review shall be a complete alternative to speech recognition. | Users can type/paste/edit; analysis and reports work; timing-only path does not shame missing transcript. |
| **ACC-013** | Camera-disabled use shall be a complete supported workflow. | Practice, manual response, content analysis, reports, saved sessions, and seeded Fairness Lab work without camera. |
| **ACC-014** | Microphone-disabled use shall be a complete supported workflow. | Typed/manual transcript works; audio metrics are `Not available`; no repeated permission nag. |
| **ACC-015** | Live coaching, self-preview, visual meters, and timer announcements shall be independently hideable/disableable. | Preferences take effect immediately and do not alter stored answer content or core controls. |
| **ACC-016** | The interface shall minimize anxiety and cognitive load. | One primary action per state, persistent Exit, no sudden sound, no punitive colour/score, plain instructions, confirmation only for material loss. |
| **ACC-017** | Detection differences shall never be presented as misconduct or personal failure. | Copy does not use “failed,” “suspicious,” “cheating,” “bad eye contact,” or trait labels for movement, silence, camera off, multi-face, or inconsistent detection. |
| **ACC-018** | Visualizations shall have adjacent text/table equivalents and meaningful headings. | Screen-reader user receives all values and conclusions without SVG/canvas interpretation; chart is `aria-hidden` when duplicative. |
| **ACC-019** | Interactive targets shall meet WCAG 2.2 target-size expectations where applicable. | Core controls are at least 24×24 CSS px with adequate spacing; primary interview controls target 44×44. |
| **ACC-020** | Assistive-technology compatibility shall be manually verified. | Defined NVDA/Chrome, NVDA/Firefox, VoiceOver/Safari, keyboard-only, zoom, forced-colors, and reduced-motion checks are recorded before release. |

## 11. Error-handling requirements

| ID | Condition | Required behaviour and acceptance criteria |
| --- | --- | --- |
| **ERR-001** | Permission denied/dismissed | Explain that access was not granted, do not infer why, show browser-settings help only on request, and continue limited mode. |
| **ERR-002** | No matching camera/microphone | Name the missing type, relax over-strict constraints once, offer refresh/device check, and continue without it. |
| **ERR-003** | Device busy or unreadable | State that the device may be in use or unavailable; stop partial tracks; offer retry or continue; do not loop prompts. |
| **ERR-004** | Track ends or device changes mid-answer | Preserve timer/transcript so far, mark affected metrics partial, announce loss once, allow finish/retry/reconnect after the answer. |
| **ERR-005** | MediaPipe asset/init/inference failure | Stop video sampling, keep preview if permission remains, mark video metrics unavailable/partial, and continue interview. |
| **ERR-006** | AudioContext suspended/fails | Offer a user-activated resume once, then timing-only mode; no fake zero level. |
| **ERR-007** | Speech unsupported, denied, no-match, network, or service error | Preserve any final text received, label it partial, expose manual editing, and never block report completion. |
| **ERR-008** | MediaRecorder unsupported, format rejected, resource error, or zero-byte result | Disable or stop recording, preserve other metrics, explain no recording was saved, and offer practice without recording. |
| **ERR-009** | IndexedDB blocked/unavailable/quota exceeded | Offer ephemeral mode if opening fails; on write failure preserve in-memory data, offer export/delete-storage actions, and never report a save that did not commit. |
| **ERR-010** | Missing/corrupt/unsupported session | Isolate record, offer safe metadata view and export where possible, return to saved sessions, and never delete automatically. |
| **ERR-011** | Export/print generation failure | Keep session intact, identify the format, offer retry/alternate format/copy text, and revoke partial object URLs. |
| **ERR-012** | Worker crash/backlog | Restart once between questions, never during active answer if it would lose state; otherwise disable video analysis and mark partial sample counts. |
| **ERR-013** | Local/future provider failure | Local question fallback shall work; future remote adapter errors shall not expose secrets or overwrite reviewed local data. |
| **ERR-014** | Unexpected render error | Route-level boundary shows recovery actions and a privacy-safe diagnostic code; active media is stopped by the global resource registry. |

Every error must have a stable code, user message, technical cause category, recoverability, next actions, and logging policy. Raw `DOMException.message` may be recorded only in a transient developer diagnostic object and shall not be the sole user-facing explanation.

## 12. Interview state and transition requirements

| Current state | Allowed event | Next state | Required side effects |
| --- | --- | --- | --- |
| `ready` | `START_PREP` | `preparing` | Snapshot question; initialize prep clock; no recording yet. |
| `ready` | `SKIP` | `betweenQuestions` | Record skipped reason/status; no empty response analysis. |
| `ready` | `END` | `complete` | Confirm when unreviewed responses exist; stop resources. |
| `preparing` | `START_ANSWER` or flexible prep expiry | `answering` | Initialize answer clock; start enabled analyzer/recorder/recognition after state commit. |
| `preparing` | `EXTEND` | `preparing` | Add configured duration and announce once. |
| `preparing` | `SKIP` | `betweenQuestions` | Stop prep clock; record skipped. |
| `preparing` | `END` | `complete` | Stop resources and preserve completed work. |
| `answering` | `FINISH` or strict expiry | `reviewing` | Atomically stop capture; finalize aggregates; create in-memory response draft. |
| `answering` | `EXTEND` | `answering` | Add time without restarting any capture service. |
| `answering` | `MEDIA_LOST` | `answering` | Mark relevant metrics partial; do not end answer. |
| `answering` | `END` | `reviewing` then `complete` | Finish current capture safely; ask save/discard for transient recording. |
| `reviewing` | `SAVE_REVIEW` | `betweenQuestions` | Persist reviewed response and optional explicitly saved recording. |
| `reviewing` | `REPEAT` | `preparing` | Preserve current attempt as draft or discard after explicit choice; increment attempt. |
| `reviewing` | `END` | `complete` | Persist or discard draft according to explicit choice. |
| `betweenQuestions` | `NEXT` | `ready` or `complete` | Advance index; clear transient analyzers; focus new question heading. |
| `complete` | `REOPEN_REPORT` | `complete` | No capture; route to report. |

### State invariants

- At most one active response draft exists.
- Capture services may be active only in `answering` and device-check subflows.
- A page refresh restores `ready`, `reviewing`, `betweenQuestions`, or `complete`, never active `preparing`/`answering`.
- A completed response stores the question snapshot and settings snapshot that produced it.
- A timer expiration is an event, not a direct component navigation.
- Strict timing is an accessibility choice, not a default proof of realism.

## 13. Question-template catalogue

The normative bank contains 60 IDs. Render tokens use braces and must always have a plain fallback. Difficulty is `foundational`, `standard`, or `advanced`. Tags drive selection, not scoring.

### General behavioural (QB-GEN-001–012)

| ID | Difficulty | Template |
| --- | --- | --- |
| QB-GEN-001 | foundational | Tell me about yourself and the experience you would bring to a {jobTitle} role. |
| QB-GEN-002 | foundational | Why are you interested in this {jobTitle} opportunity{companyClause}? |
| QB-GEN-003 | foundational | What is one strength you would use regularly in this role? |
| QB-GEN-004 | standard | Tell me about a time you solved a difficult problem. What did you personally do? |
| QB-GEN-005 | standard | Describe a time priorities changed unexpectedly. How did you respond? |
| QB-GEN-006 | standard | Tell me about a mistake or setback and what you changed afterward. |
| QB-GEN-007 | standard | Describe a time you had to learn a new skill or process quickly. |
| QB-GEN-008 | standard | Tell me about a disagreement at work or school and how you handled it. |
| QB-GEN-009 | standard | Give an example of how you managed several deadlines at once. |
| QB-GEN-010 | advanced | Describe a decision you made with incomplete information. What trade-offs did you consider? |
| QB-GEN-011 | advanced | Tell me about a time your first approach did not work. How did you diagnose and revise it? |
| QB-GEN-012 | advanced | Which part of your experience is most transferable to {jobTitle}, and where would you still need to grow? |

### Software and technical (QB-TEC-001–012)

| ID | Difficulty | Template |
| --- | --- | --- |
| QB-TEC-001 | foundational | Walk me through a recent software project and your contribution. |
| QB-TEC-002 | foundational | Which technologies are you most comfortable using, and how have you applied them? |
| QB-TEC-003 | foundational | How do you approach debugging when an application is not behaving as expected? |
| QB-TEC-004 | standard | Tell me about an API you designed or integrated. What decisions mattered? |
| QB-TEC-005 | standard | Describe how you have modelled, stored, or queried application data. |
| QB-TEC-006 | standard | Give an example of improving accessibility, responsiveness, or usability in an interface. |
| QB-TEC-007 | standard | How do you test a feature before considering it complete? |
| QB-TEC-008 | standard | Tell me about a Git, CI/CD, container, or deployment problem you resolved. |
| QB-TEC-009 | standard | Describe a security or privacy consideration you handled in a project. |
| QB-TEC-010 | advanced | Design a high-level approach for a {keyword} feature that must remain reliable when a dependency fails. |
| QB-TEC-011 | advanced | Describe a technical trade-off you made involving performance, maintainability, or delivery time. |
| QB-TEC-012 | advanced | A production issue appears only for some users. How would you investigate, contain, and verify a fix? |

### Customer service (QB-CS-001–012)

| ID | Difficulty | Template |
| --- | --- | --- |
| QB-CS-001 | foundational | What does good customer service mean to you? |
| QB-CS-002 | foundational | Tell me about a time you helped someone understand a confusing process. |
| QB-CS-003 | foundational | How do you stay calm when a customer is frustrated? |
| QB-CS-004 | standard | Describe a difficult customer interaction and the outcome. |
| QB-CS-005 | standard | Tell me about a time you could not give a customer exactly what they requested. |
| QB-CS-006 | standard | Give an example of finding the root cause behind a recurring customer issue. |
| QB-CS-007 | standard | How have you balanced speed with accuracy in a service environment? |
| QB-CS-008 | standard | Tell me about feedback from a customer or colleague that changed your approach. |
| QB-CS-009 | standard | Describe how you documented or escalated an issue for another team. |
| QB-CS-010 | advanced | A customer reports an urgent problem with limited evidence. How would you investigate and communicate? |
| QB-CS-011 | advanced | Tell me about a time policy and customer expectations conflicted. What did you do? |
| QB-CS-012 | advanced | How would you identify whether a service problem is isolated or systemic? |

### Leadership (QB-LEAD-001–012)

| ID | Difficulty | Template |
| --- | --- | --- |
| QB-LEAD-001 | foundational | Describe a time you took ownership without being asked. |
| QB-LEAD-002 | foundational | How do you communicate expectations when working with others? |
| QB-LEAD-003 | foundational | Tell me about a time you supported a teammate's development. |
| QB-LEAD-004 | standard | Describe a project or initiative you led and how you kept it on track. |
| QB-LEAD-005 | standard | Tell me about a time you delegated work. How did you decide what to delegate? |
| QB-LEAD-006 | standard | Give an example of resolving conflict within a team. |
| QB-LEAD-007 | standard | Describe how you handled resistance to a change. |
| QB-LEAD-008 | standard | Tell me about a decision that affected other people and how you communicated it. |
| QB-LEAD-009 | standard | How have you used documentation, training, or process improvement to strengthen a team? |
| QB-LEAD-010 | advanced | Describe a time you had to balance team wellbeing, quality, and a hard deadline. |
| QB-LEAD-011 | advanced | Tell me about a leadership decision you would now make differently. |
| QB-LEAD-012 | advanced | How would you lead a response when ownership is unclear and the impact is growing? |

### Investigative (QB-INV-001–012)

| ID | Difficulty | Template |
| --- | --- | --- |
| QB-INV-001 | foundational | Describe your approach to gathering and organizing information. |
| QB-INV-002 | foundational | Tell me about a time careful observation helped you identify an issue. |
| QB-INV-003 | foundational | How do you separate facts, assumptions, and unanswered questions? |
| QB-INV-004 | standard | Describe an investigation or research task and the steps you personally completed. |
| QB-INV-005 | standard | Tell me about a time sources or accounts conflicted. How did you assess them? |
| QB-INV-006 | standard | Give an example of documenting findings for someone who was not present. |
| QB-INV-007 | standard | How have you protected confidential or sensitive information? |
| QB-INV-008 | standard | Tell me about a time new evidence changed your working theory. |
| QB-INV-009 | standard | Describe how you maintained accuracy during a long or repetitive assignment. |
| QB-INV-010 | advanced | You have a deadline, incomplete evidence, and several plausible explanations. How do you proceed? |
| QB-INV-011 | advanced | Describe a decision about when to continue investigating and when to conclude. |
| QB-INV-012 | advanced | Tell me about presenting a defensible finding while clearly communicating its limits. |

### Custom category

Custom questions are user-authored and use IDs `QB-CUSTOM-{uuid}`. They are not analyzed for authorship quality. The app trims whitespace, limits a question to 500 characters, rejects blank questions, and warns on normalized duplicates while allowing the user to keep a deliberate duplicate after confirmation.

### Required fallback order

1. unused template in selected category and difficulty;
2. unused template in selected category at adjacent difficulty;
3. unused general behavioural template;
4. one of five hard-coded, role-neutral recovery questions;
5. stop selection and ask the user to reduce count or add a custom question.

No generated text may fabricate a company fact, job duty, credential, résumé achievement, or skill the user did not provide.

## 14. Analysis-policy summary

The detailed calculations are normative in [06_FairScreen_Measurement_Specification.md](./06_FairScreen_Measurement_Specification.md). The following rules apply to every analyzer:

- Analysis runs only on a reviewed transcript.
- English-language heuristics may be incomplete for other languages or speech-to-text errors.
- Evidence means a matching text span or observable timing value, not proof that the underlying interpretation is true.
- A missing cue is reported as “not detected,” never “did not happen.”
- Numbers are optional. A strong answer need not contain a metric when a metric would be unnatural or confidential.
- STAR is a coaching scaffold, not a universal answer requirement.
- Pace, pauses, fillers, silence, and length are style observations. They do not change relevance, specificity, contribution, or outcome ratings.
- No grammar, accent, dialect, vocabulary prestige, sentiment, emotion, or personality rating is allowed.
- Heuristic output includes `heuristicVersion` and `transcriptRevisionId`.

## 15. Edge cases

| Edge case | Expected result |
| --- | --- |
| User ignores a permission prompt indefinitely | Setup remains cancellable; after a non-blocking timeout message, user may continue limited mode. No second automatic prompt. |
| Permission granted but device labels are blank | Use “Default camera/microphone” and stable in-session ordering; refresh labels after stream opens. |
| Multiple cameras share identical labels | Include ordinal and facing mode where exposed; never persist raw device IDs beyond necessary settings, and tolerate rotation across sessions. |
| User changes device during device check | Stop old tracks before attaching new; reset calibration; do not duplicate audio graphs. |
| User changes device mid-answer | Mark partial; do not interrupt answer; offer reconnect for next attempt. |
| Browser returns no audio samples or constant zero | Mark level unavailable after validation window; do not interpret as silence. |
| Very noisy room | Calibration increases threshold within capped bounds; report limited calculation quality and avoid precise pause claims. |
| User communicates with pauses, AAC, sign, or typed input | Allow untimed/manual path; silence and pace remain unavailable or descriptive; content analysis uses reviewed text only. |
| No face detected | Continue; state “A face shape was not consistently detected,” list possible setup causes, and do not imply user failure. |
| More than one face-like region detected | Report condition only; note backgrounds/posters/screens can cause detections; no identity or misconduct inference. |
| User looks at the displayed question | Explain camera/display offset and use near-camera orientation, not eye contact. |
| Mirrored preview | Analysis uses unmirrored coordinate normalization or explicitly mirrors thresholds; user display choice cannot change metric. |
| Browser tab hidden | Timers derive from monotonic timestamps rather than tick counts; active media follows documented pause/stop policy; no background recording. |
| Laptop sleeps | On resume, mark timing gap and require user confirmation to continue/retry; do not count sleep as speech silence. |
| Strict timer expires during a speech-recognition finalization | Stop capture, wait bounded finalization, retain partial final transcript, then review. |
| Speech service returns interim text only | Preserve as unconfirmed raw result and require manual review; never analyze interim status directly. |
| Transcript is blank or under minimum evidence | Content categories become `notAvailable` or `needsMoreEvidence` as specified; no zero score. |
| Transcript includes confidential names/numbers | No external call; export preview warns; user can edit/redact before analysis/export. |
| User repeats same trial in Fairness Lab | Preserve both with attempt labels; selection is user-controlled; no cherry-picking algorithm. |
| Similarity cannot be calculated | State why; show independent trials; do not make invariance claim. |
| Seeded demo already loaded | Loading is idempotent and does not create duplicates. |
| IndexedDB upgrade blocked by another tab | Explain close/refresh, keep current data in memory, and never delete or force-close the other tab. |
| Quota exceeded after recording | Keep transient recording in memory while page remains open, offer download/discard/delete-local-data, and do not claim save. |
| Origin data is evicted between visits | Show normal empty state with explanation that browser storage is best effort; do not imply the user deleted it. |
| JSON from newer schema imported later | MVP has no import. If added, future version must use read-only inspection and never downgrade destructively. |
| Print is invoked while transcript editor has unsaved changes | Prompt to apply or discard local editor changes before generating print. |
| Route error occurs while capturing | Global resource registry stops all tracks/recognition/recorders/workers before recovery UI. |

## 16. Data retention and deletion policy

| Data | Default retention | User action | Deletion behaviour |
| --- | --- | --- | --- |
| Camera frame | Current sample only | None | Discard after processing. |
| Audio sample buffer | Current analysis window only | None | Reuse/release after aggregation. |
| Face landmarks/matrix | Current frame only | None | Discard inside worker; never cross persistence boundary. |
| Recognition raw alternatives | Current review plus minimal metadata if user saves response | Review transcript | Delete with response/session. |
| Reviewed transcript | Saved with response | Save response | Delete with response/session/all data. |
| Aggregate metrics | Saved with response/trial | Save response/trial | Delete with owning record. |
| Recording Blob | Memory only | Explicit “Save recording on this device” | Delete independently or with owner; revoke URLs. |
| Job/résumé context | Session snapshot | Create/save session | Delete with session/all data; optional exclusion from export. |
| Notes | Owning local record | Save note | Delete with owner/all data; optional export. |
| User settings | Until reset/delete/browser eviction | Save setting | Reset separately or include in all-data deletion after scope disclosure. |
| Demo records | Until Remove demo/delete/browser eviction | Load demo | Namespace-only removal. |

There is no server-side retention period because the MVP has no application server.

## 17. Release acceptance gate

Release 1 is blocked unless:

1. all `must` requirements have passing evidence or an approved decision-log deferral;
2. the camera-free three-question journey passes;
3. the seeded Fairness Lab works with all permissions denied;
4. content results remain identical when only video fixtures change;
5. no prohibited feature or language is found;
6. transient landmark/frame/audio data cannot be written through repository types;
7. active media stops on every exit and error path;
8. recording is off by default and never auto-saves;
9. speech-service disclosure appears before recognition;
10. WCAG timing, keyboard, focus, status, reflow, contrast, reduced-motion, and alternatives checks pass;
11. storage and quota failures preserve an export/discard path;
12. current browser matrix results and known limitations are published; and
13. print, text, and JSON outputs contain the required warning:

> Camera position, gaze direction, lighting, facial movement, disability, culture, anxiety, and hardware setup are not reliable measures of job competence. Visual measurements are provided only to help users understand video-call conditions.
