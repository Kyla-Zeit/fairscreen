# FairScreen Master Specification

**Version:** 1.0  
**Date:** 2026-07-28  
**Status:** Implementation-ready product specification and Codex handoff  
**Product:** FairScreen — “Practice the interview. Question the scoring.”

## 1. Executive summary

FairScreen is a privacy-focused, local-first web application for interview practice and fairness education. A user configures a role and question set, practices with any combination of optional camera, optional microphone, optional browser speech recognition, manual transcript, or neither device, reviews their transcript, and receives deterministic evidence-linked feedback about answer content. Optional audio/video observations describe capture conditions only. A separate Fairness Lab compares the same answer under different user-labeled recording conditions without interpreting those conditions as competence.

The MVP is a static React/TypeScript application with no application backend, account, analytics, tracking, remote logging, or secret. Raw camera frames, face landmarks/matrices/blendshapes, and PCM arrays are transient. Recording is off by default and requires both pre-answer capture choice and post-capture local-save choice. Content analysis cannot receive video metrics, and no overall or hiring-related score exists.

This package specifies the product; it does not implement or deploy it.

## 2. Package contents

| Document | Purpose |
|---|---|
| [01_FairScreen_Executive_Brief.md](01_FairScreen_Executive_Brief.md) | Product thesis, users, value, scope, risks, success, portfolio story |
| [02_FairScreen_PRD.md](02_FairScreen_PRD.md) | Normative requirements: 50 functional, 14 non-functional, 17 privacy, 20 accessibility, 14 error families |
| [03_FairScreen_UX_Specification.md](03_FairScreen_UX_Specification.md) | Sitemap, flows, state behavior, page/component specs, exact copy, responsive/accessibility rules |
| [04_FairScreen_Technical_Architecture.md](04_FairScreen_Technical_Architecture.md) | Stack, dependency boundaries, folders, browser ports, media workers, persistence, security, performance |
| [05_FairScreen_Domain_Models.md](05_FairScreen_Domain_Models.md) | Canonical TypeScript models, discriminated unions, ports, invariants, persistence boundaries |
| [06_FairScreen_Measurement_Specification.md](06_FairScreen_Measurement_Specification.md) | Audio/video formulas, deterministic content rules, transcript similarity, thresholds, limitations, fixtures |
| [07_FairScreen_Privacy_and_Responsible_AI.md](07_FairScreen_Privacy_and_Responsible_AI.md) | Data lifecycle, threat model, consent, harm analysis, prohibited uses, safe copy, governance |
| [08_FairScreen_Implementation_Roadmap.md](08_FairScreen_Implementation_Roadmap.md) | Fifteen ordered Codex-sized milestones with scope, files, tests, risks, and release gates |
| [09_FairScreen_Testing_and_QA.md](09_FairScreen_Testing_and_QA.md) | Static/unit/component/integration/browser/privacy/accessibility/manual test plan and traceability |
| [10_FairScreen_Codex_Handoff.md](10_FairScreen_Codex_Handoff.md) | Repository blueprint, conventions, definition of done, and 16 ordered copy-paste Codex prompts |
| [11_FairScreen_Decision_Log.md](11_FairScreen_Decision_Log.md) | Accepted/deferred design decisions, alternatives, consequences, and revisit gates |

## 3. Normative priority

If an implementation question is not directly answered:

1. Preserve the prohibited-feature, privacy, and content/video separation boundaries.
2. Follow the PRD requirement and acceptance criterion.
3. Follow the Domain Models and Measurement Specification for types, formulas, thresholds, and exact invariant copy.
4. Follow the UX Specification for interaction, state, content, and accessibility behavior.
5. Follow the Technical Architecture and Decision Log for implementation structure.
6. Follow the Roadmap and Codex Handoff for task scope/order.
7. Stop and record a decision rather than silently inventing a protected behavior.

The specification uses **shall** for a normative requirement, **should** for a recommended design, and **may** for an allowed option.

## 4. Product boundary

### 4.1 In scope

- Interview setup using role context, optional résumé text, five question categories, difficulty, timing, and custom questions.
- At least 60 deterministic local question templates.
- Camera-free, microphone-free, manual-transcript, and timing-only practice.
- Optional camera/microphone device check and active-capture controls.
- Optional local audio timing/level aggregates.
- Optional local MediaPipe face-presence/framing/centring/orientation/brightness/multi-face condition aggregates.
- Optional browser speech recognition after disclosure, with manual review.
- Deterministic content categories with evidence and cautious suggestions.
- Reports, retries, saved sessions, notes, deletion, print, text, and JSON export.
- Fairness Trial comparisons and camera-free seeded demo.
- Accessible, responsive, static portfolio deployment.

### 4.2 Out of scope

- Hiring decisions, candidate ranking, suitability/employability/competence scoring.
- Identity, face recognition, emotion, personality, demographic, disability/medical, honesty, intent, confidence, engagement, liveness, proctoring, or anti-cheating inference.
- Claims that gaze, movement, silence, lighting, camera position, or detection quality predicts job performance.
- Live third-party interview assistance, answer injection, behavior alteration/disguise, platform automation, or background recording.
- Backend, account, cross-device sync, collaboration, analytics, ads, tracking, remote error reporting, or remote AI provider.
- Bias certification, causal inference, or legal/regulatory compliance claims.

## 5. Non-negotiable design invariants

1. `AnswerAnalyzer` has no `VideoMetrics` input or import.
2. Answer Content and Video Conditions remain separate in services, types, storage, UI, print, text, and JSON.
3. No overall/combined score exists, including hidden/internal fields.
4. Camera, microphone, recording, and browser speech recognition are optional and just in time.
5. Automatic text is not analyzed until the user reviews it.
6. Raw frames, face landmarks, blendshapes, matrices, and PCM arrays are never persisted or exported.
7. A completed recording remains transient until the separate post-review save action.
8. Browser/API failure preserves a useful fallback and never fabricates a zero measurement.
9. The seeded Fairness Lab works without permission or hardware.
10. All runtime assets are same-origin; no user data is sent to a FairScreen server because none exists.
11. Errors/logs contain technical codes and state, not user content or device labels.
12. Accessibility alternatives are complete workflows, not secondary degraded experiences.

## 6. Approved stack and architecture snapshot

- React, strict TypeScript, Vite, Tailwind CSS, React Router `HashRouter`, Lucide React, and Zod boundary validation.
- Vitest, Testing Library, ESLint, Prettier, Playwright, and axe-based accessibility checks.
- Feature-oriented modules with stable domain ports.
- React Context for app dependencies/settings; feature reducers and a pure interview state machine.
- Native IndexedDB repositories plus an in-memory ephemeral repository.
- Web Audio and optional MediaRecorder behind browser ports.
- Same-origin packaged MediaPipe Tasks Vision Face Landmarker, lazily initialized in a dedicated worker.
- Transcription and analysis behind typed providers; local/manual deterministic implementations only in MVP.
- Static host-neutral build; no service worker/PWA in MVP.

## 7. Capability status and fallback matrix

The product must distinguish documentation-confirmed platform behavior from observed browser support.

| Capability | Specification status | Implementation stance | Required fallback |
|---|---|---|---|
| `getUserMedia()` | Confirmed web API in secure contexts with permission; a request may remain pending | Detect, request after explanation/action, handle timeout/pending/denial | Continue with one or neither device |
| `enumerateDevices()` | Confirmed API; labels/non-default exposure can be permission-gated | Use default before permission; refresh after grant | Default device or no selector |
| Web Audio `AnalyserNode` | Confirmed API; AudioContext can require user activation/resume | Start only after user action; calculate local aggregates | Timing-only/no audio metrics |
| MediaRecorder | Standardized API with browser/format/resource variation | Check MIME candidates and handle actual construction/start failure | Practice without recording |
| Worker + WebAssembly | Broad platform primitives; exact performance/device behavior varies | Capability test; bounded queue; worker failure recovery | Preview without analysis or no video metrics |
| MediaPipe Face Landmarker web | Confirmed library API; synchronous video calls can block a caller | Same-origin pinned assets; dedicated worker; 8 fps target | Interview continues without video metrics |
| Browser SpeechRecognition | Browser-dependent and limited; processing can be vendor-remote | Disclose, opt in, derive capability at runtime, never promise local/offline | Manual editable transcript, then timing-only |
| IndexedDB | Confirmed structured local storage; quota, eviction, and private-mode behavior vary | Versioned migrations and honest best-effort language | Ephemeral session plus export |
| Storage estimate/persistence | Browser-dependent estimates/decisions | Label approximate; absence is not a failure | Omit estimate and retain data controls |
| Print/download Blob | Broad platform support with browser formatting variation | Feature-detect where needed and test every target | Alternate format/copy text |
| Automated backlighting conclusion | Experimental within this product | Default-off feature flag until diverse-fixture gate | Brightness only; user-described condition label |

Primary platform references: [MDN `getUserMedia`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [MDN `enumerateDevices`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices), [MediaStream Recording specification](https://www.w3.org/TR/mediastream-recording/), [MDN `MediaRecorder.isTypeSupported()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static), [MediaPipe Face Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js), [Web Speech API](https://webaudio.github.io/web-speech-api/), [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), and [MDN storage quotas/eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

## 8. Measurement posture

Measurements are descriptive implementation outputs, not validated psychological, behavioral, hiring, or clinical constructs.

### 8.1 Audio

The approved pipeline samples approximate RMS/dBFS at 20 Hz after user action, establishes a local noise floor, applies versioned adaptive VAD and hysteresis, and aggregates timing, pause, level, clipping, and coverage values. It does not judge accent, fluency, emotion, truth, confidence, enthusiasm, or competence.

### 8.2 Video

The approved pipeline samples at a target 8 fps with queue depth one and uses transient MediaPipe outputs to calculate approximate face presence, centring, framing, near-camera orientation, brightness, multi-face presence, and coverage/failure counts. It does not perform emotion, identity, gaze-quality, liveness, demographic, disability, or competence inference. Facial movements alone do not provide a universal diagnostic mapping to internal emotional states; this scientific limitation is central to the product boundary ([Barrett et al., 2019](https://doi.org/10.1177/1529100619832930)).

### 8.3 Answer content

Only the reviewed transcript and documented prerequisites enter deterministic category rules. Ratings are `strong`, `developing`, `needsMoreEvidence`, `notAvailable`, or `notApplicable`; evidence spans and limitations accompany outputs. Missing evidence is never invented.

### 8.4 Fairness similarity

The Fairness Lab uses versioned local text normalization, token-frequency unigram cosine, ordered-word-trigram Jaccard, and:

$$
S = 0.60 \times \text{cosine} + 0.40 \times \text{Jaccard}
$$

Bands and word-count guards are normative in the Measurement Specification. A small trial comparison is descriptive and cannot establish causality, model bias, or competence.

## 9. Privacy and responsible-AI posture

FairScreen applies data minimization, purpose limitation, just-in-time permission, local processing, storage transparency, deletion, user-reviewed text, and explicit fallbacks. This aligns with the direction of [W3C Privacy Principles on data minimization](https://www.w3.org/TR/privacy-principles/#data-minimization) and recognizes the heightened sensitivity of biometric processing described by the [Office of the Privacy Commissioner of Canada](https://www.priv.gc.ca/en/privacy-topics/health-genetic-and-other-body-information/biometrics/gd_bio_org-final/).

The MVP does not claim legal compliance. Before any real hiring-related use, obtain jurisdiction-specific legal, accessibility, privacy, and employment review. Public regulators have warned that algorithmic hiring tools can create disability discrimination risks; FairScreen therefore treats camera/movement alternatives and prohibited inferences as structural requirements, not optional copy ([EEOC/DOJ warning](https://www.eeoc.gov/newsroom/us-eeoc-and-department-justice-warn-against-disability-discrimination)).

## 10. Implementation sequence

Implement in the 15 milestones in the Roadmap:

1. repository/design foundation;
2. routing/static education;
3. domain/IndexedDB;
4. setup/capability/permission;
5. questions;
6. interview state/timing;
7. audio/recording;
8. local video;
9. transcription/review;
10. content analysis;
11. reports/sessions/export;
12. Fairness Lab;
13. accessibility completion;
14. integrated QA/privacy/browser matrix;
15. production hardening.

Then run the final audit prompt. Do not ask Codex to build the complete app in one task.

## 11. Acceptance and traceability snapshot

| Normative set | Count | Primary source | Verification source |
|---|---:|---|---|
| Functional requirements | 50 | PRD FR-001–FR-050 | Roadmap milestones; QA traceability |
| Non-functional requirements | 14 | PRD NFR-001–NFR-014 | Architecture; QA; hardening |
| Privacy requirements | 17 | PRD PRIV-001–PRIV-017 | Privacy document; QA privacy audit |
| Accessibility requirements | 20 | PRD ACC-001–ACC-020 | UX; QA accessibility protocol |
| Error families | 14 | PRD ERR-001–ERR-014 | Architecture recovery; QA integration fixtures |
| Implementation milestones | 15 | Roadmap M01–M15 | Codex prompts 1–15 |
| Final integration audit | 1 | Codex Handoff prompt 16 | Release evidence package |

No release can proceed while a requirement lacks automated or named manual evidence.

## 12. Assumptions

- Initial UI and heuristic language is English; unsupported-language content categories return unavailable/not applicable rather than guessing.
- The product runs in a modern secure-context browser; desktop is the complete test target and mobile is a responsive limited mode.
- Users understand that data on a shared browser profile is accessible to others with that browser/device access; FairScreen does not claim application-level encryption.
- The first load requires network access to same-origin static assets. There is no PWA/service worker guarantee.
- The final Node, package, MediaPipe model, browser, and host versions are selected and recorded during implementation/release, then pinned.
- Real-device QA uses consented observation without retaining identifiable media under this MVP plan.

## 13. Open risks and human gates

| Risk/gate | Current control | Human action |
|---|---|---|
| Landmark/model performance varies across people and conditions | Neutral wording, coverage, no trait inference, fallback, diverse-fixture gate | Review diverse, non-retained QA before enabling gated labels |
| Browser speech support/processing changes | Runtime detection, disclosure, manual/timing fallback | Record exact release-browser behavior |
| Storage eviction/quota/private browsing varies | Best-effort copy, ephemeral mode, export/delete recovery | Verify release browsers and host origin behavior |
| Automated accessibility is incomplete | Named manual AT scripts and no invented evidence | Run NVDA/Chrome, NVDA/Firefox, VoiceOver/Safari, keyboard/zoom/forced-colors/motion |
| Static host can break permissions/WASM through headers/MIME | Host-neutral examples and M15 validation | Select host and review cost, terms, region, HTTPS, headers, MIME/cache |
| Heuristics can appear more authoritative than they are | Evidence spans, no overall score, cautious copy, algorithm version | Editorial/responsible-AI review of every message |
| Fairness demo can be mistaken for certification | Synthetic label, separate datasets, causal/bias limitations | Review portfolio narrative and public copy |
| Future provider expansion can introduce data transfer/secrets | Stable ports but no remote adapter | New decision, backend threat model, consent/retention/security/cost review |

## 14. Specification quality checks

The package is designed so implementation can be checked mechanically:

- all named deliverables exist and cross-link;
- requirements, models, formulas, decisions, milestones, prompts, and tests use stable IDs;
- critical state names, rating enums, invariant copy, timing modes, similarity formula, and privacy boundaries are repeated consistently;
- browser-dependent behavior is not stated as universal;
- experimental backlighting remains default-off;
- every optional feature has a documented fallback;
- implementation prompts keep work reviewable and ordered;
- production deployment remains a human decision.

The final pre-handoff verification procedure is in the QA Specification and must be rerun against the implemented repository; this specification package itself is not evidence that the application passes those tests.

### Package validation completed 2026-07-28

- All 12 required Markdown files are present and every local Markdown link resolves.
- Markdown code fences are balanced.
- The PRD contains exactly 50 FR, 14 NFR, 17 PRIV, 20 ACC, and 14 ERR identifiers.
- All 115 requirement acceptance criteria have minimum evidence mapped in the QA plan.
- The question catalogue contains 60 unique built-in IDs, 12 in each required bank.
- All 16 specifically requested TypeScript domain models are defined without `any`.
- The Roadmap contains 15 complete milestone templates; the Handoff contains 15 milestone prompts plus one final audit prompt.
- The Decision Log contains 25 complete records.
- Canonical state, timing-mode, rating, analyzer, and similarity names were checked across documents.

These are document-structure and consistency checks. Browser, accessibility, model, performance, and real-device claims remain implementation-time tests and human gates as explicitly identified above.
