# FairScreen Decision Log

**Version:** 1.0  
**Date:** 2026-07-28  
**Status:** Accepted decisions for MVP

## 1. How decisions are recorded

Statuses:

- **Accepted:** required for the MVP.
- **Deferred:** intentionally unresolved until a named gate.
- **Superseded:** retained for history; a later decision controls.

A protected decision covers privacy boundaries, prohibited inferences, measurement rules, content/video separation, persistence, provider architecture, accessibility alternatives, or release security. Changing one requires a new decision entry, affected version increments, synchronized specification changes, and regression/privacy/accessibility review.

## 2. Decision index

| ID | Decision | Status |
|---|---|---|
| D-001 | Client-only static MVP | Accepted |
| D-002 | No trait, identity, competence, or hiring inference | Accepted |
| D-003 | No overall or combined score | Accepted |
| D-004 | Separate answer content from capture conditions | Accepted |
| D-005 | MediaPipe Face Landmarker for local condition inputs | Accepted |
| D-006 | Video inference in a worker with lossy sampling | Accepted |
| D-007 | Raw media-derived inputs are transient | Accepted |
| D-008 | Browser speech is optional; manual is the reliable fallback | Accepted |
| D-009 | Automatic transcripts require review | Accepted |
| D-010 | Recording uses two separate choices | Accepted |
| D-011 | Deterministic, inspectable content heuristics for MVP | Accepted |
| D-012 | Native IndexedDB plus in-memory fallback | Accepted |
| D-013 | Runtime validation at untrusted boundaries with Zod | Accepted |
| D-014 | Hash routing for host-neutral static deployment | Accepted |
| D-015 | React Context, reducers, and typed ports | Accepted |
| D-016 | Same-origin packaged runtime assets and system fonts | Accepted |
| D-017 | Flexible, strict-practice, and untimed modes | Accepted |
| D-018 | No service worker/PWA in MVP | Accepted |
| D-019 | Pairwise deterministic transcript similarity | Accepted |
| D-020 | Seeded camera-free Fairness Lab demo | Accepted |
| D-021 | Backlighting conclusion remains gated | Accepted |
| D-022 | No full-text transcript index | Accepted |
| D-023 | Playwright and axe supplement the intended test stack | Accepted |
| D-024 | Future remote providers may use ports but are not implemented | Accepted |
| D-025 | Host selection and production deployment are human decisions | Deferred |
| D-026 | Local resume file parsing uses pinned browser dependencies | Accepted |
| D-027 | Resume input is upload-only with explicit extracted-text confirmation | Accepted |
| D-028 | Explicit session identity for repeated practice starts | Accepted |
| D-029 | Job posting import and company research use consented provider ports | Accepted |

## 3. Decision records

### D-001 — Client-only static MVP

**Status:** Accepted

**Context:** The portfolio objective emphasizes privacy, inspectability, and graceful browser fallbacks. The core workflows do not require shared state or server computation.

**Alternatives considered**

1. Static client-only application.
2. Application backend for sessions and analysis.
3. Account-based cloud synchronization.

**Decision:** Build the MVP as a static client-side application with no application backend, account, sync, or application-data API.

**Why:** It minimizes data disclosure, deployment complexity, secrets, and trust claims while remaining sufficient for practice, local analysis, saved sessions, and the Fairness Lab.

**Consequences**

- Browser storage is best-effort and device/origin-specific.
- No cross-device recovery or collaboration.
- Browser-controlled speech recognition may still use vendor services after disclosure; it is not a FairScreen backend.
- Static-host security headers and same-origin asset delivery remain necessary.

**Revisit when:** A validated user need requires cross-device access or a capability cannot be provided safely on device. Revisit requires a new data-protection/threat model and explicit consent/retention design.

---

### D-002 — No trait, identity, competence, or hiring inference

**Status:** Accepted

**Context:** Facial movement and capture conditions do not support reliable personal or competence conclusions, and automated hiring-related inferences can cause discriminatory harm. A major review documents substantial contextual and cultural variability in facial movement ([Barrett et al., 2019](https://doi.org/10.1177/1529100619832930)); U.S. employment guidance warns about disability-related screen-out from algorithmic tools ([EEOC/DOJ, 2022](https://www.eeoc.gov/newsroom/us-eeoc-and-department-justice-warn-against-disability-discrimination)).

**Alternatives considered**

1. Infer confidence, emotion, engagement, honesty, personality, identity, suitability, or competence.
2. Infer none of these and report only approved observable conditions.
3. Hide such outputs from the UI but retain internal scores.

**Decision:** No model, type, service, copy, fixture, storage field, export, or internal score may infer identity, emotion, personality, demographic traits, disability/medical state, honesty, intent, confidence, employability, competence, proctoring/cheating status, or hiring suitability.

**Why:** The inferences are outside the product purpose, scientifically and contextually unsafe, and likely to harm users. Hidden/internal inference would carry the same risk.

**Consequences**

- Prohibited-feature and prohibited-language tests are release blockers.
- “Face present,” “approximately centred,” and similar conditions must include uncertainty and cannot be reframed as personal quality.
- FairScreen cannot claim to validate commercial hiring-scoring systems.

**Revisit when:** Do not revisit for this product identity. A different product would require a new charter, evidence base, legal review, and governance.

---

### D-003 — No overall or combined score

**Status:** Accepted

**Context:** A single number would collapse incommensurate content categories and capture conditions, imply ranking, and invite hiring use.

**Alternatives considered**

1. Weighted overall score.
2. Separate sub-scores with a total.
3. Separate categorical feedback without a total.

**Decision:** Use separate categorical ratings and descriptive metrics only. Do not calculate or display an overall, suitability, employability, confidence, competence, or combined performance score.

**Why:** Category-level evidence is more inspectable and avoids false precision or unintended selection use.

**Consequences**

- Reports need clear hierarchy without a headline score.
- Charts/tables cannot imply a total through aggregation.
- Tests scan domain fields, copy, fixtures, routes, and exports.

**Revisit when:** Not for MVP; any reconsideration is a protected product-charter change.

---

### D-004 — Separate answer content from capture conditions

**Status:** Accepted

**Context:** The fairness objective depends on showing that changes in video conditions do not imply changes in answer quality.

**Alternatives considered**

1. Use visual/audio conditions as content-analysis features.
2. Calculate independent datasets but join them in a weighted report.
3. Separate them at every boundary.

**Decision:** Content analysis accepts no video metrics. Answer Content and Video Conditions remain separate in types, service dependencies, persistence, UI, reports, comparisons, and exports.

**Why:** Structural separation is more enforceable than copy disclaimers and directly expresses the product's fairness position.

**Consequences**

- Architecture/import tests and video-fixture mutation tests are mandatory.
- Fairness Lab tables cannot join content ratings to video metrics in one row or combined visualization.
- Audio timing may support pace only when the documented prerequisite exists; it cannot introduce trait inference.

**Revisit when:** Never within the FairScreen MVP charter.

---

### D-005 — MediaPipe Face Landmarker for local condition inputs

**Status:** Accepted

**Context:** Optional face landmarks and transformation matrices can support approximate, local capture-condition geometry without sending frames to an application server. Google's web guide documents normalized landmarks and optional transformation matrices for Face Landmarker ([Google AI Edge](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)).

**Alternatives considered**

1. MediaPipe Tasks Vision Face Landmarker.
2. Remote computer-vision API.
3. Browser-native shape detection where available.
4. No video measurements.

**Decision:** Use a pinned, licensed, same-origin packaged MediaPipe Face Landmarker for the approved optional video-condition aggregates.

**Why:** It supports local processing and the required landmark/matrix outputs. A remote API conflicts with the privacy boundary; native alternatives do not provide adequate consistent capability.

**Consequences**

- Model/WASM size, license, integrity, lazy loading, and browser performance must be managed.
- Model output is approximate and may vary across people/devices/conditions.
- Failure never blocks the interview.
- No blendshape interpretation is permitted.

**Revisit when:** A better local, auditable option improves privacy, accessibility, accuracy, or bundle cost. Re-run every golden/diverse fixture and update algorithm version.

---

### D-006 — Video inference in a worker with lossy sampling

**Status:** Accepted

**Context:** Browser Face Landmarker video calls are synchronous and can block the calling thread; Google recommends using a worker for camera-frame work ([Google AI Edge](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)). Interview controls must remain responsive.

**Alternatives considered**

1. Main-thread inference on every frame.
2. Worker inference with a queue.
3. Worker inference with queue depth one and stale-frame dropping.

**Decision:** Run video inference in a dedicated worker at target 8 fps, configurable 5–10, with queue depth one and stale-frame dropping.

**Why:** Condition aggregates do not need every frame. Bounded lossy sampling protects controls and avoids growing latency.

**Consequences**

- Output records sampled/dropped counts and partial coverage.
- Worker protocol is typed/versioned and emits aggregates only.
- A worker crash may restart once between questions or degrade to unavailable.

**Revisit when:** Profiling across the supported matrix supports a different target without harming control responsiveness or privacy.

---

### D-007 — Raw media-derived inputs are transient

**Status:** Accepted

**Context:** Frames, landmarks, matrices, blendshapes, and PCM arrays are sensitive and unnecessary after aggregate calculation.

**Alternatives considered**

1. Save raw inputs for later reanalysis/debugging.
2. Save sampled landmarks.
3. Save approved aggregates only.

**Decision:** Discard camera frames immediately after the sample, keep landmarks/matrices only within current worker computation, reuse/release audio arrays, and persist only approved aggregates and coverage/failure metadata.

**Why:** Data minimization reduces exposure and prevents feature creep into identity/trait analysis.

**Consequences**

- Reanalysis after an algorithm change is not possible without a new session.
- Diagnostics use synthetic fixtures and technical codes.
- Storage schemas and worker-to-main result messages reject raw fields; main-to-worker frame transfers remain transient and are closed after processing.

**Revisit when:** Do not revisit without a new privacy purpose, explicit consent, retention/deletion model, and threat assessment.

---

### D-008 — Browser speech is optional; manual is the reliable fallback

**Status:** Accepted

**Context:** Browser speech recognition has uneven support and may send audio to a browser/vendor service; MDN marks `SpeechRecognition` as limited availability and describes server-based implementations ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)). FairScreen cannot guarantee local or offline processing.

**Alternatives considered**

1. Require browser recognition.
2. Bundle a local speech model.
3. Use browser recognition after disclosure, with manual and timing-only fallbacks.
4. Add a cloud transcription API.

**Decision:** Provide a typed browser-recognition adapter only after disclosure and opt-in. Manual editable transcript is the reliable default/fallback; timing-only completion is always available.

**Why:** It preserves accessibility and usefulness without a backend, large local model, secret, or false support claim.

**Consequences**

- Capability is runtime-derived and conservative.
- Unsupported/declined/error paths are first-class.
- Browser/vendor processing is outside FairScreen's local-only application-data path and must be disclosed.

**Revisit when:** A practical local model meets bundle, performance, language, licensing, accessibility, and privacy gates.

---

### D-009 — Automatic transcripts require review

**Status:** Accepted

**Context:** Recognition mistakes can materially alter deterministic feedback.

**Alternatives considered**

1. Analyze automatic text immediately.
2. Show text but analyze unless user objects.
3. Require explicit review/edit confirmation.

**Decision:** Automatic transcript content is not analyzed until the user confirms “I reviewed this transcript.” Final/interim recognition text remains separate and transient during review; persistence keeps the reviewed revision and privacy-safe technical provider/error metadata rather than a duplicate unreviewed transcript.

**Why:** The user must control the text treated as their answer and be able to correct recognition error.

**Consequences**

- Analysis action has a domain and UI gate.
- Partial finalized text is preserved for editing.
- Interim/unreviewed text clears after active review or exit and cannot enter persistence/export schemas.
- Timing-only mode bypasses content analysis rather than inventing text.

**Revisit when:** Not while automatic recognition is fallible.

---

### D-010 — Recording uses two separate choices

**Status:** Accepted

**Context:** Enabling capture for one answer should not silently create persistent media.

**Alternatives considered**

1. Auto-save every enabled recording.
2. Save by default and offer delete.
3. First choose capture, then separately choose local save after review.

**Decision:** Recording is off by default. The user first enables capture and later explicitly selects “Save recording on this device.” Until then the completed Blob is transient.

**Why:** It separates immediate practice utility from durable sensitive storage.

**Consequences**

- Navigation from review must offer save or discard.
- Quota failure retains transient review only while practical and never claims success.
- Text/JSON exports never embed recording data.

**Revisit when:** Not without a new consent and retention design.

---

### D-011 — Deterministic, inspectable content heuristics for MVP

**Status:** Accepted

**Context:** The MVP needs useful feedback without remote AI, hidden prompts, non-determinism, or fabricated claims.

**Alternatives considered**

1. Remote LLM analysis.
2. Local generative model.
3. Versioned deterministic rules with evidence spans.
4. No content feedback.

**Decision:** Implement the documented deterministic local rule set and categorical ratings.

**Why:** Rules can be tested at boundaries, explained, versioned, and run offline without a secret or data upload.

**Consequences**

- Feedback is limited and English-oriented.
- The UI must expose evidence and limitations.
- Rule changes increment the algorithm version and golden fixtures.

**Revisit when:** A future provider passes privacy, truthfulness, bias, accessibility, cost, security, and fallback review. The deterministic provider remains available.

---

### D-012 — Native IndexedDB plus in-memory fallback

**Status:** Accepted

**Context:** Sessions, transcripts, metrics, and optional saved recordings exceed simple key-value needs and require transactions/indexes. IndexedDB is the browser's asynchronous structured-data store and supports files/blobs ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)).

**Alternatives considered**

1. `localStorage`.
2. Native IndexedDB.
3. Third-party IndexedDB abstraction.
4. Server database.

**Decision:** Use native IndexedDB behind typed repositories, with an equivalent in-memory ephemeral repository.

**Why:** It supports structured records/Blobs and avoids another runtime dependency or backend while keeping domain code independent.

**Consequences**

- An adapter must manage verbose browser events, migrations, blocked opens, transactions, and corrupt records.
- Storage is described as origin-scoped, best-effort, browser-dependent.
- No full guarantee of durability or encryption is claimed.

**Revisit when:** Native complexity causes demonstrated reliability issues and an audited library offers material value without changing the domain port.

---

### D-013 — Runtime validation at untrusted boundaries with Zod

**Status:** Accepted

**Context:** TypeScript types do not validate IndexedDB records, worker messages, imports/exports, or configuration at runtime.

**Alternatives considered**

1. Handwritten validators.
2. Zod schemas at boundaries.
3. Generate JSON Schema and validators from a separate IDL.

**Decision:** Use Zod at persistence, export/import, worker-message, and external-configuration boundaries. Keep stable TypeScript domain models and avoid parsing inside pure domain calculations.

**Why:** It provides readable boundary validation and schema composition without introducing a separate code-generation pipeline.

**Consequences**

- Zod becomes an approved runtime dependency and must be pinned/audited.
- Avoid duplicate divergent definitions: schemas and inferred boundary types must map explicitly to canonical domain models.
- Exported JSON schema still needs a documented versioned representation and independent fixtures.

**Revisit when:** Bundle analysis or schema drift shows a material problem; an alternative must retain runtime validation and migration recovery.

---

### D-014 — Hash routing for host-neutral static deployment

**Status:** Accepted

**Context:** Static hosts vary in their ability to rewrite deep routes to `index.html`.

**Alternatives considered**

1. Browser history routing with host rewrite rules.
2. Hash routing.
3. Multi-page static generation.

**Decision:** Use React Router `HashRouter`.

**Why:** It provides portable route refresh/back behavior without host-specific rewrites, consistent with a portfolio deployment.

**Consequences**

- In-page fragments need a distinct pattern.
- URLs include `#`.
- Non-root base-path tests remain required for assets.

**Revisit when:** A confirmed host with durable rewrite configuration is selected and migration value exceeds URL churn.

---

### D-015 — React Context, reducers, and typed ports

**Status:** Accepted

**Context:** State is feature-oriented and mostly local; media/browser behavior must be testable.

**Alternatives considered**

1. Global state-management library.
2. React Context plus feature reducers and pure state machines.
3. Page-local ad hoc state and direct browser calls.

**Decision:** Use React Context for app-level dependencies/settings and feature reducers/pure state machines for workflows. Access browsers/storage/providers through typed ports.

**Why:** It limits dependencies, keeps transitions deterministic, and supports fakes without coupling pages to infrastructure.

**Consequences**

- Contexts must remain scoped to avoid broad rerenders.
- Dependency rules prevent pages from calling APIs directly.
- If complexity expands, ports preserve the option to change state tooling.

**Revisit when:** Profiling or workflow complexity demonstrates a concrete need, not preference.

---

### D-016 — Same-origin packaged runtime assets and system fonts

**Status:** Accepted

**Context:** Remote scripts, fonts, icons, models, or WASM introduce tracking, availability, and supply-chain risk.

**Alternatives considered**

1. Public CDN assets.
2. Same-origin bundled/self-hosted assets.
3. Mixed delivery with fallbacks.

**Decision:** Serve all runtime code, model/WASM, fonts/icons, and other assets from the application origin. Use the system font stack and application-bundled Lucide React icons; icons never carry meaning without text or an accessible name.

**Why:** It makes the runtime network boundary inspectable and supports offline-after-load core behavior.

**Consequences**

- Bundle/hosting must support model/WASM MIME and cache rules.
- Licenses and asset integrity inventory are repository responsibilities.
- No external font branding; Lucide is compiled into the application bundle rather than loaded from a CDN.

**Revisit when:** Only after a privacy/security review; a remote asset is not needed for MVP.

---

### D-017 — Flexible, strict-practice, and untimed modes

**Status:** Accepted

**Context:** Interview practice benefits from timing, but hard limits can create accessibility and anxiety barriers.

**Alternatives considered**

1. Fixed countdown that ends every answer.
2. Untimed only.
3. Flexible default, explicit strict-practice, and untimed options.

**Decision:** Provide all three. Flexible never hard-stops; strict requires explicit opt-in, warnings, and one-action extension; untimed is fully functional.

**Why:** It supports realistic practice while preserving user control and the WCAG timing-adjustment principle of turning off, broadly adjusting, or extending time limits ([W3C SC 2.2.1](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)).

**Consequences**

- Timer state and sparse announcement rules are more complex.
- Reports distinguish configured mode and actual duration.
- No timing mode affects a competence conclusion.

**Revisit when:** User research supports changed defaults within the same accessibility guarantees.

---

### D-018 — No service worker/PWA in MVP

**Status:** Accepted

**Context:** A PWA could improve offline startup but adds cache invalidation, model-version, update, storage, and lifecycle complexity.

**Alternatives considered**

1. Full installable PWA with service worker.
2. App shell cache only.
3. No service worker; static assets work offline only after browser cache/load behavior permits.

**Decision:** Do not implement a service worker or installable PWA in MVP.

**Why:** It keeps update and privacy behavior simpler and avoids serving stale measurement/model code.

**Consequences**

- First load requires network.
- “Offline” claims are limited to core use after same-origin assets have loaded and remain browser-available.
- Deployment has fewer cache lifecycle risks.

**Revisit when:** Offline-first use is validated and a version-safe cache/update design is specified.

---

### D-019 — Pairwise deterministic transcript similarity

**Status:** Accepted

**Context:** The Fairness Lab needs a transparent method to identify identical or substantially unchanged answer content without a semantic model.

**Alternatives considered**

1. String equality only.
2. Embedding/LLM semantic similarity.
3. Versioned normalization plus cosine/Jaccard and word-count guards.

**Decision:** Use the Measurement Specification's normalization, token-frequency unigram cosine, ordered-word-trigram Jaccard, `0.60/0.40` weighted score, word-count guards, bands, and all-pair group rule.

**Why:** The calculation is local, deterministic, inspectable, and sufficient for the seeded demonstration.

**Consequences**

- Paraphrase semantics and negation are not reliably understood.
- Component values and transcript differences are shown with the band.
- Threshold changes increment version and update golden fixtures.

**Revisit when:** Evidence shows the current method miscommunicates material differences; do not silently replace it with a black-box model.

---

### D-020 — Seeded camera-free Fairness Lab demo

**Status:** Accepted

**Context:** The fairness concept should be understandable without permissions, hardware, or personal media.

**Alternatives considered**

1. Require users to record trials.
2. Provide screenshots/video samples.
3. Provide deterministic synthetic aggregate records and identical transcript.

**Decision:** Ship the documented four-condition, clearly synthetic, camera-free seeded demo.

**Why:** It makes the core fairness point immediately accessible and testable without collecting personal data.

**Consequences**

- Demo IDs are namespaced and removal is isolated.
- Demo cannot be presented as empirical validation or proof of model bias.
- Exact data is a golden fixture.

**Revisit when:** Add only reviewed synthetic scenarios; never replace it with identifiable participant data without a separate protocol.

---

### D-021 — Backlighting conclusion remains gated

**Status:** Accepted

**Context:** A reliable “backlit” conclusion needs more than global brightness and requires diverse-condition validation.

**Alternatives considered**

1. Label backlighting using a simple brightness threshold.
2. Implement a regional contrast heuristic and enable immediately.
3. Keep the output disabled behind a QA gate.

**Decision:** Accept the condition label for user-described Fairness trials, but keep automated backlighting conclusion disabled until the exact diverse-fixture validation gate in the Measurement Specification passes.

**Why:** It avoids presenting an under-validated image condition as fact.

**Consequences**

- UI may report brightness without an automated backlit label.
- Enabling requires documented fixtures, false-positive/negative review, decision amendment, and config-version change.

**Revisit when:** The specified validation evidence exists and privacy/accessibility reviewers approve the wording.

---

### D-022 — No full-text transcript index

**Status:** Accepted

**Context:** Saved-session search can be useful, but indexing every transcript increases sensitive duplication and scope.

**Alternatives considered**

1. Index all transcript and résumé text.
2. Search allowed metadata/question text/notes through bounded local queries.
3. No search.

**Decision:** Search job title, company, question text, and specified user notes; do not create a full-text transcript, résumé, or job-description index.

**Why:** It balances useful session retrieval with data minimization.

**Consequences**

- Transcript content is not discoverable through global search.
- Search implementation must not scan recording binary.
- Notes search follows the exact scope in the PRD.

**Revisit when:** User research demonstrates a strong need and a minimized local index lifecycle is specified.

---

### D-023 — Playwright and axe supplement the intended test stack

**Status:** Accepted

**Context:** Unit/component tools alone cannot verify routing, permissions, real browser APIs, print behavior, network boundaries, or integrated accessibility.

**Alternatives considered**

1. Vitest and Testing Library only.
2. Add Playwright and axe-based automation plus manual AT checks.
3. Use a hosted testing service.

**Decision:** Add Playwright and `axe-core`/equivalent local accessibility integration. Keep named manual browser/assistive-technology evidence.

**Why:** The browser and privacy requirements need real-browser interception and interaction. Automated accessibility tools do not replace manual AT testing.

**Consequences**

- CI is larger and browser-version records require maintenance.
- Permission/media cases still need a real-device manual matrix.
- No hosted test telemetry is needed for MVP.

**Revisit when:** A different local tool demonstrably improves coverage without weakening evidence.

---

### D-024 — Future remote providers may use ports but are not implemented

**Status:** Accepted

**Context:** The architecture should not prevent future provider experimentation, but current privacy/scope does not authorize it.

**Alternatives considered**

1. Hard-code local implementations directly in pages.
2. Define typed provider ports with local implementations only.
3. Implement local and remote providers now.

**Decision:** Define typed question, transcription, and content-analysis ports with local implementations and test fakes. Do not implement a remote provider in MVP.

**Why:** Ports preserve replaceability/testing without adding data transfer, secrets, cost, or consent complexity.

**Consequences**

- Page components remain provider-agnostic.
- A future remote adapter requires server-side secret handling, explicit data-flow consent, retention/security/accuracy review, cost review, and complete fallback.

**Revisit when:** A separate approved milestone defines the remote architecture and governance.

---

### D-025 — Host selection and production deployment are human decisions

**Status:** Deferred

**Context:** Static providers differ in cost, regions, terms, security headers, WASM MIME behavior, access controls, and domain configuration.

**Alternatives considered**

1. Select a provider during specification.
2. Keep the build host-neutral and select after a release candidate.
3. Deploy automatically to the first available host.

**Decision:** Keep the repository host-neutral. Codex may prepare and validate configuration examples but must not purchase, configure paid resources, or deploy without human review.

**Why:** Host/cost/account/security choices require authority and facts not present in the product brief.

**Consequences**

- Final URL and exact header syntax remain unresolved.
- M15 must validate the chosen host's HTTPS, CSP, Permissions-Policy, referrer policy, model/WASM MIME, cache, and non-root behavior before deployment.

**Revisit when:** A release candidate exists and the owner selects a host after cost, terms, region, and security review.

---

### D-026 â€” Local resume file parsing uses pinned browser dependencies

**Status:** Accepted

**Context:** M07.1 adds optional PDF, DOCX, and TXT resume import before M08.
The app must parse files locally without uploads, remote conversion services,
browser extensions, OCR, or persistence of original document bytes.

**Alternatives considered**

1. Paste-only resume text.
2. Browser-local parsing with pinned bundled dependencies.
3. Remote conversion, OCR, or AI extraction.
4. Support legacy DOC files.

**Decision:** Add local parsing with exact-pinned `pdfjs-dist` for PDF text
extraction and `mammoth` for DOCX plain-text extraction. TXT uses `File.text()`.
Legacy DOC is unsupported with guidance to save as DOCX or PDF. M07.2 supersedes
the original paste/edit setup path with upload-only confirmation.

**Why:** It improves setup ergonomics while preserving the local-first privacy
boundary. The parser packages are auditable, bundled from the FairScreen origin,
and testable with synthetic fixtures.

**Consequences**

- Dependency and third-party notices must include the parser packages and
  bundled Mammoth browser dependencies.
- PDF.js worker assets must load from the configured non-root FairScreen base
  path.
- Original files, filenames, bytes, parser objects, and buffers must remain
  transient and absent from persistence, exports, logs, diagnostics, and React
  snapshots.
- Scanned/image-only PDFs remain unsupported because FairScreen does not run
  OCR.

**Revisit when:** Browser support, bundle size, parser security advisories, or
release license review show a material issue.

---

### D-027 — Resume input is upload-only with explicit extracted-text confirmation

**Status:** Accepted

**Context:** M07.2 changes the setup product contract after M07.1. Optional
resume context remains useful for deterministic local question generation, but
editable paste fields make it harder to explain the file-import lifecycle and
created stale product copy around "paste instead" recovery.

**Alternatives considered**

1. Keep paste/edit as a parallel primary path.
2. Keep file import but populate an editable textarea.
3. Stage extracted plain text in a read-only preview and persist it only after
   explicit user confirmation.

**Decision:** Remove manual resume typing and pasting from setup. Use PDF, DOCX,
and TXT file selection as the only resume input path. Stage extracted plain text
with file format, character count, and a collapsed read-only preview. Persist
only confirmed extracted text in `resumeText`.

**Why:** The upload-only flow is easier to explain, test, and audit. It keeps
the original file, filename, document bytes, parser objects, and parsing buffers
out of persistence and diagnostics while preserving the deterministic provider's
plain-text context requirement.

**Consequences**

- Replacement of an already confirmed resume requires user confirmation.
- Changing, replacing, or removing a resume invalidates generated questions and
  requires deliberate regeneration.
- Error copy must tell users to upload another valid text-based document instead
  of pasting text.
- The application version is injected from `package.json` so footer/config
  metadata tracks the package version.

**Revisit when:** A future accessibility or import usability review shows that
upload-only input blocks a required no-file workflow; any change must preserve
local-only parsing and explicit persistence boundaries.

---

### D-028 — Explicit session identity for repeated practice starts

**Status:** Accepted

**Context:** M08.2 repairs a lifecycle defect where **Start another interview**
could restore a completed practice session when the user reused the same job
title and questions. Session identity must not collapse to the normalized job
title, and device-review state must not silently reuse stale media settings.

**Alternatives considered**

1. Keep job-title-derived IDs and clear more sessionStorage keys.
2. Treat every completed session as non-resumable.
3. Generate a fresh explicit session seed for each started interview and carry
   that ID through the setup, device-review, practice, and report routes.

**Decision:** Each explicitly started interview receives a unique session ID.
**Start another interview** clears the current progress record, preserves setup
fields only for convenience, and starts a new route/session snapshot. Requested
camera or microphone choices must be tested in device review or explicitly
skipped before **Begin practice**.

**Why:** Job titles, companies, resumes, and generated questions are user
content, not durable identity. A unique session boundary prevents completed
state, attempts, selected attempts, transient recordings, and old media choices
from being reopened as a new workflow while preserving safe reload/resume for
the active session.

**Consequences**

- Saved-session resume/review/practice-again behavior remains an M11 feature and
  must use IndexedDB records with unique session IDs.
- Combined recording status can claim camera and microphone only after one live
  video track and one live audio track are present.
- Browser/device manual checks are still required for real Chrome, Edge,
  Firefox, and Safari media behavior.

**Evidence and affected versions:** Implemented in application version `0.8.2`
with `progressPersistence`, setup/device/interview routes, device-review tests,
interview lifecycle tests, combined-media tests, browser smoke, and traceability
updates.

**Revisit when:** M11 saved sessions introduces explicit Resume, Review,
Practice again, Rename, Delete, Export, and Delete recording actions.

---

### D-029 - Job posting import and company research use consented provider ports

**Status:** Accepted

**Context:** M08.3 introduces optional job posting import and company research
before transcription or answer analysis. These are the first deliberately
internet-connected capabilities in the product concept, but the current static
client must preserve the local-only practice path and must not expose resumes,
answers, recordings, notes, transcripts, camera data, microphone data, saved
sessions, or provider credentials from the browser bundle.

**Alternatives considered**

1. Fetch job and company pages directly from the browser.
2. Embed third-party provider credentials or SDK configuration in Vite/client
   code.
3. Define typed provider ports with deterministic fakes and an unavailable
   default; require a future server-side/provider boundary for real retrieval.

**Decision:** Add `JobPostingImportService` and `CompanyResearchProvider` ports.
The default browser implementation never fetches remote pages and returns a
recoverable unavailable result. A real provider must run outside the browser
bundle, hold credentials server-side, accept only HTTP/S URLs, block localhost
and private-network targets, enforce redirect, size, content-type, timeout, and
rate limits, sanitize markup without loading scripts/assets, and avoid logging
private practice data. Company research requires explicit first-use consent that
lists the setup fields sent and the sensitive fields never sent.

**Why:** Provider ports let the UI, question generation, fallback behavior, and
privacy tests be built now without normalizing browser data egress or client
secrets. The consent gate makes the new network boundary visible while keeping
camera-free, microphone-free, resume-only, and fully local setup paths intact.

**Consequences**

- Job posting import is an explicit action, never triggered by typing a URL.
- Imported title/company/location/description and research findings require user
  review before they can replace setup fields or feed local question generation.
- Research output separates source-supported facts from inferences, labels
  anecdotal interview material cautiously, and lets users include, exclude,
  refresh, inspect, or delete findings.
- URL, import/research timestamps, safe resume filename metadata, and provider
  status may persist with the setup/session snapshot; raw pages, scripts,
  provider secrets, local file paths, and private practice data do not.

**Evidence and affected versions:** Implemented in application version `0.8.3`
with setup provider ports, consent and fallback UI, URL/filename normalization
tests, provider-payload privacy tests, browser no-egress coverage, sticky-nav
checks, and updated dependency/privacy/architecture documentation.

**Revisit when:** A real job/company provider is selected or M11 saved sessions
stores provider-backed research with explicit save/reopen/export behavior.

## 4. Open decision register

Only these release-time selections remain open; none blocks implementation through M14:

| Open item | Needed by | Decision owner | Required evidence |
|---|---|---|---|
| Exact Node LTS and dependency versions | M01 commit | Engineering owner | Supported versions, lockfile, clean build |
| MediaPipe model/package version and integrity | M08 | Engineering + privacy reviewer | License, local asset test, fixtures, performance |
| Automated backlighting enablement | After M08; default off | Product + responsible-AI + accessibility | Diverse-fixture gate and copy review |
| Production host/domain | After M15 | Product owner | Cost, terms, region, HTTPS, headers, MIME/cache |
| Release browser version claims | M14/M15 | QA owner | Dated executed matrix |
| Accessibility exceptions, if any | M13/M15 | Accessibility + product | Severity, impact, workaround, owner/date |

## 5. Supersession template

Add future records; never edit history to hide a changed decision.

```text
### D-NNN — Short title
Status: Accepted | Deferred | Superseded
Supersedes: D-NNN, if applicable
Context:
Alternatives considered:
Decision:
Why:
Consequences:
Evidence and affected versions:
Revisit when:
```


## ADR-022 — Reviewed transcript boundary and practice-only coaching

**Status:** Accepted  
**Affected version:** `0.10.0`

**Context:** M09 and M10 add browser speech recognition, transcript review,
post-answer coaching, and optional live prompts. These features must remain
truthful about browser processing, must not analyse unreviewed generated text,
and must not become employer-style assessment.

**Decision:**

1. Browser speech recognition is opt-in and preceded by a disclosure that its
   processing location may be unknown. Declining or lacking support never blocks
   manual or timing-only practice.
2. Browser-generated text is stored as an unreviewed revision. Content coaching
   runs only after the user confirms or edits a reviewed revision.
3. Deterministic coaching uses the question, reviewed transcript, locale,
   approved job/company context, and genuinely relevant résumé evidence only.
4. Live prompts are optional, dismissible, limited to one at a time, and governed
   by a shared cooldown. They never end, score, or rank an answer.
5. Video measurements remain outside the content-analyzer input contract. No
   emotion, identity, personality, honesty, disability, accent-quality,
   confidence, competence, or hiring-suitability inference is produced.

**Consequences:** Users receive useful practice guidance without hidden data
flows or invented experience. Browser speech accuracy remains fallible, so the
review boundary is mandatory. Reports, exports, and saved-session management
remain later milestones.
