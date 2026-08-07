# FairScreen Executive Product Brief

**Document status:** Implementation-ready product direction  
**Research baseline:** 2026-07-28  
**Product line:** **Practice the interview. Question the scoring.**

## Executive summary

FairScreen is a privacy-focused interview-practice application and fairness-auditing portfolio project. It recreates the pacing of an automated video interview, gives deterministic coaching on what a candidate actually said, and separately describes observable video-call conditions. It never treats a webcam as a mind reader.

The product has two equally important jobs:

1. help a job applicant practice relevant, concrete, well-structured answers; and
2. make visible how camera placement, lighting, framing, movement, hardware, disability, culture, and anxiety can change machine-observed video conditions without changing an answer's competence-related content.

The MVP is a client-side React application. Camera frames, audio samples, and face landmarks are processed transiently in the browser. Raw face landmarks are discarded. Recordings are optional and are saved only after an explicit user action. Sessions and settings use IndexedDB. No application backend, account, analytics service, or frontend API key is required.

## Problem

Automated interview systems can make applicants feel that they must perform for a camera rather than communicate relevant experience. Common coaching advice can reinforce that pressure by describing gaze, facial movement, speaking style, or visible affect as proof of confidence, honesty, enthusiasm, personality, or employability.

That leap is not scientifically or ethically justified. A major review of facial-expression research concluded that facial movements do not map reliably and specifically to internal emotional states across people, situations, and cultures. The review calls for more context-sensitive, variable-aware research rather than universal emotion labels ([Barrett et al., 2019](https://doi.org/10.1177/1529100619832930)). U.S. employment guidance also warns that algorithmic tools can screen out qualified people with disabilities when they interpret disability-related speech, movement, or interaction patterns as negative signals ([U.S. EEOC and DOJ, 2022](https://www.eeoc.gov/newsroom/us-eeoc-and-department-justice-warn-against-disability-discrimination)).

At the same time, applicants still benefit from practicing:

- answering within an expected time window;
- recognizing common question patterns;
- giving a specific example;
- explaining their own contribution;
- stating a result or lesson; and
- checking ordinary video-call conditions before an interview.

The design opportunity is to preserve useful practice while refusing unsupported psychological inference.

## Proposed solution

FairScreen provides five connected experiences:

1. **Learn:** a concise explanation of what the product measures, what it refuses to infer, how local processing works, and why visual scoring can mislead.
2. **Prepare:** job-context entry, question configuration, capability checks, device selection, and camera/microphone-optional setup.
3. **Practice:** a calm, accessible automated-interview simulation with adjustable or disabled timing, keyboard controls, optional condition prompts, and explicit states.
4. **Review:** editable transcript, deterministic answer-content analysis, separate audio/video condition metrics, retries, notes, print, and export.
5. **Compare:** a central Fairness Lab that holds answer content constant while showing how observable video conditions vary. A seeded, camera-free demonstration makes the product's argument available to every user.

## Target users

### Primary

- Job applicants preparing for asynchronous or automated interviews.
- Applicants who are anxious about camera-based evaluation.
- Disabled and neurodivergent applicants who may be harmed by normative assumptions about gaze, movement, facial visibility, speech, or timing.
- Applicants using older hardware, low-bandwidth setups, unusual camera placements, or shared spaces.

### Secondary

- Career coaches teaching answer structure without endorsing pseudo-psychological scoring.
- Recruiters, designers, and students examining responsible uses of browser-based machine learning.
- Portfolio reviewers evaluating React, TypeScript, browser APIs, accessibility, privacy design, deterministic analysis, and testing architecture.

### Explicitly not a target user

FairScreen is not an employer assessment, ranking, proctoring, identity-verification, surveillance, or third-party interview-assistance tool.

## User value

| User need | FairScreen response |
| --- | --- |
| “What should I practice?” | Relevant local question templates based on category, role, job-description terms, résumé skills, and difficulty. |
| “Was my answer concrete?” | Cautious, evidence-linked analysis of relevance, specificity, contribution, outcome, measurable evidence, and possible STAR elements. |
| “What happened during the recording?” | Descriptive timing, audio, framing, brightness, face-presence, and near-camera-orientation observations with explicit uncertainty. |
| “Does looking away mean I answered badly?” | No. Content analysis and video conditions are technically and visually separated. |
| “What if I cannot or do not want to use a camera?” | Camera-free and microphone-free practice, manual transcripts, timing-only feedback, and a complete seeded Fairness Lab demo. |
| “Where does my data go?” | No FairScreen server. Local processing and storage, optional browser-vendor speech recognition only after a specific disclosure, and direct deletion/export controls. |
| “Can I show my progress?” | Searchable sessions, per-question retries, notes, print view, plain-text export, and versioned JSON export. |

## Product principles

### 1. Content before conditions

Answer-content coaching concerns the words in the reviewed transcript. Video-call condition measurements never change content ratings, suggestions, strengths, or a combined score.

### 2. Describe; do not diagnose

The product may say, “A face shape was detected in 82% of sampled frames.” It must not say, “You appeared disengaged,” “You lacked confidence,” or “You were dishonest.”

### 3. Camera direction is not eye contact

FairScreen uses **near-camera orientation** for an approximate head-direction condition. It does not claim to know where a user is looking. Looking at the on-screen question or displayed interviewer is normal and can appear below or beside the webcam.

### 4. Optional means optional

Camera, microphone, transcription, live prompts, and recording are independently optional. Refusing an optional input never blocks the core practice flow.

### 5. Local by default, ephemeral where possible

Process transient media in memory, discard frame-level landmarks, store only necessary aggregates, and make recording retention a deliberate choice. Data minimization lowers disclosure and misuse risk ([W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/#data-minimization)).

### 6. Uncertainty is part of the interface

Every approximate metric declares its data source, limitations, failure state, and whether it can influence coaching. “Not available” is a valid and expected result.

### 7. Accessibility is product behaviour

Timing can be disabled or broadly adjusted; screen-reader announcements are sparse and useful; every workflow is keyboard-operable; camera and microphone alternatives are first-class. WCAG 2.2 explains that users may require additional time and calls for disabling, adjusting, or extending content-imposed limits ([W3C, Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)).

### 8. No hidden assistance

FairScreen is for practice before a real interview. It does not provide covert live answers, eye redirection, prerecorded injection, virtual-camera manipulation, or automation of third-party platforms.

## Differentiators

- **Fairness Lab as a core workflow:** not a footnote or ethics page.
- **Hard separation of domains:** answer content and video conditions have separate models, services, storage fields, reports, and UI regions.
- **No suitability score:** the product does not collapse unrelated observations into an employability number.
- **Deterministic, inspectable heuristics:** every result can identify the rule and transcript evidence that produced it.
- **Meaningful limited-functionality mode:** the application remains useful without camera, microphone, speech recognition, MediaPipe, or recording.
- **No account or backend in the MVP:** a smaller collection surface and a clearer portfolio architecture.
- **Research-grounded language:** the product teaches why observations are not psychological traits.

## Scope

### MVP includes

- Responsive landing, education, privacy, saved-session, settings, setup, interview, report, and Fairness Lab routes.
- At least 60 reviewed local question templates across the required categories.
- Deterministic keyword extraction, seeded question selection, difficulty variants, and duplicate prevention.
- An explicit interview state machine.
- Timed, flexible-timed, and untimed practice.
- Optional media permissions and device selection.
- Web Audio-based level and voice-activity approximations.
- MediaPipe Face Landmarker-based condition measurements when supported.
- Browser speech recognition behind capability and privacy checks, plus manual transcript and timing-only fallbacks.
- Editable transcripts before analysis.
- Deterministic answer-content heuristics with evidence and cautious wording.
- IndexedDB sessions, optional recordings, settings, Fairness Lab trials, and deletion.
- Print, plain-text, and versioned JSON exports.
- Seeded Fairness Lab data.
- Unit, component, integration, accessibility, and cross-browser end-to-end tests.

### Deferred

- Accounts, synchronization, collaboration, cloud storage, telemetry, and analytics.
- A server-side AI question or analysis provider.
- Multilingual analysis beyond an English-language MVP.
- Native mobile applications.
- Formal legal compliance certification.
- Production use by employers.

### Permanently prohibited

- Emotion, honesty, deception, confidence, personality, enthusiasm, or employability scoring.
- Face recognition, identity verification, demographic classification, or biometric categorization.
- Automated hiring recommendations or candidate ranking.
- Eye redirection, virtual-camera manipulation, prerecorded injection, or third-party interview automation.
- Hidden real-time answer generation or answers delivered during a third-party interview.
- Background recording or automatic recording retention.
- Claims that gaze, expression, movement, voice, or visible affect predicts job performance.

## Research-backed feasibility

| Capability | 2026 evidence | Product decision |
| --- | --- | --- |
| Camera and microphone | `getUserMedia()` is widely available, requires a secure context and permission, and may remain pending if the user ignores the prompt ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)). | Ask just in time, permit cancellation, map each error, and never make media mandatory. |
| Device list | `enumerateDevices()` is broadly available, but non-default devices and labels are permission-gated ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices)). | Show generic defaults before permission and refresh labels after permission. |
| Recording | `MediaRecorder` is broadly available, while specific formats and codecs vary; even a supported type can fail under resource pressure ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)). | Probe MIME types, handle runtime errors, and make recording optional. |
| Audio analysis | `AnalyserNode` provides real-time time-domain and frequency data without changing the stream ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)). | Calculate approximate RMS/dBFS and voice activity locally; do not interpret personality. |
| Face landmarks | MediaPipe Face Landmarker can return 478 landmarks per face and optional transformation matrices. Its video calls are synchronous and block the calling thread; Google recommends a worker ([Google AI Edge](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)). The web solution remains a preview. | Lazy-load self-hosted model assets, run inference in a worker, discard landmarks after aggregation, and fall back cleanly. |
| Speech recognition | `SpeechRecognition` is not Baseline across major browsers and some implementations send audio to a server-based recognition service ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)). | Default to manual/timing-safe behaviour; use recognition only after feature detection and a specific privacy choice. |
| Browser storage | IndexedDB stores structured data and blobs asynchronously, but browser quotas and eviction policies differ; best-effort data can be evicted and private-mode data is normally cleared when the session ends ([MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [MDN storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)). | Treat storage as fallible, estimate usage, catch quota errors, explain local persistence, and make export easy. |

## Principal risks and controls

| Risk | Likely harm | Control |
| --- | --- | --- |
| Users mistake condition metrics for competence | Reinforces the harmful scoring model the product critiques | Separate services, types, UI panels, exports, and tests; no combined score; persistent disclaimer. |
| Approximate face detection performs inconsistently | Disabled users or users with different appearance, movement, lighting, or hardware receive misleading feedback | Neutral wording, user-controlled thresholds only for practice, “Not available,” no content effect, camera-free path, and no demographic claims. |
| Speech recognition is inaccurate or remote | Incorrect transcript analysis or unexpected audio disclosure | Explicit provider disclosure, edited transcript required before analysis, manual fallback, and no automatic analysis of unreviewed text. |
| Local recordings consume storage or remain on a shared device | Accidental disclosure or quota failure | Recording off by default, in-memory review, explicit save, storage estimate, retention explanation, deletion, and export warning. |
| MediaPipe work degrades the interview UI | Jank, missed controls, anxiety, inaccessible timers | Worker-based inference, 5–10 fps sampling rather than every frame, load shedding, and automatic disable on repeated failure. |
| Product is repurposed for employer screening | Applicants are judged with non-validated signals | License/use notice, no ranking APIs or batch candidate flows, prohibited-feature tests, and architecture that stores only a single user's practice sessions. |
| “AI” branding overstates capability | User trust is misplaced | Call the MVP analysis deterministic, local, approximate, and inspectable; avoid anthropomorphic language. |

## Success criteria

The MVP is successful when:

- a user can complete and review a three-question session with no camera and no microphone;
- a user can complete the same flow with media enabled and understand exactly what was processed and retained;
- denying or losing any optional browser capability results in a useful fallback rather than a dead end;
- every content-analysis statement links to a documented heuristic and, where applicable, transcript evidence;
- no visual metric changes any answer-content category;
- the seeded Fairness Lab demonstrates unchanged answer content and changing video conditions without camera permission;
- all major interview controls work by keyboard and with a screen reader;
- timer limits can be disabled, broadly configured, or extended;
- all stored data can be inspected at a high level, exported, individually deleted, or deleted together;
- automated tests enforce the prohibited-feature boundary and domain separation;
- the current and previous major versions of desktop Chrome, Edge, Firefox, and Safari pass the defined core-flow matrix, with limited-functionality expectations documented;
- the portfolio can explain its design decisions, threat model, browser constraints, test coverage, and ethical limits without claiming formal compliance or predictive validity.

## Portfolio value

FairScreen demonstrates:

- strict TypeScript domain modelling and service boundaries;
- React routing, component design, reducers, and accessible state transitions;
- camera, microphone, recording, Web Audio, workers, WebAssembly, and IndexedDB integration;
- fault-tolerant capability detection and graceful degradation;
- deterministic text analysis with evidence rather than opaque scoring;
- local-first privacy architecture and data lifecycle documentation;
- responsible-AI boundaries implemented as code constraints, not marketing copy;
- a central comparison experience with accessible data visualization;
- unit, integration, component, accessibility, browser, and failure-path testing.

## Go/no-go guardrails

The project may proceed to implementation only while all of these remain true:

1. The MVP has no employer-facing ranking or assessment workflow.
2. Answer-content feedback remains independent of visual and audio-condition observations.
3. No feature infers an internal psychological state.
4. The application is fully usable without camera access.
5. Speech recognition does not run until its possible remote-processing implications are disclosed.
6. Raw facial landmarks are never persisted.
7. Recordings are never saved automatically.
8. Runtime third-party scripts, trackers, and remote model assets are absent.

If a future request violates a guardrail, it requires product rejection, not merely a new setting.

