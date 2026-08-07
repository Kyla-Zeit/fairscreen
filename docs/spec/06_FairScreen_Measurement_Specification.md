# FairScreen Measurement and Deterministic Analysis Specification

**Version:** 1.0  
**Status:** Normative algorithm specification  
**Purpose:** Define every MVP measurement precisely enough to implement and test without inventing psychological meaning.

## 1. Non-negotiable interpretation rules

1. Measurements describe the captured session and browser setup, not the person.
2. No audio/video metric is evidence of confidence, honesty, emotion, attention, enthusiasm, personality, disability, culture, employability, or competence.
3. **Near-camera orientation** is an approximate head-direction condition. It is not eye tracking, gaze tracking, attention, or eye contact.
4. Looking at the displayed interviewer or question is normal. The physical offset between display and camera can make screen-directed looking appear off-camera.
5. Visual metrics never enter `AnswerAnalyzer`, never change an answer-content rating, and never appear in an overall score.
6. Audio style metrics do not change relevance, specificity, contribution, outcome, measurable-evidence, or STAR results.
7. “Not available” and “Partial” are valid expected outputs.
8. Thresholds are product defaults for descriptive practice, not validated norms. They are versioned and must be visible in technical details.
9. The MVP produces no single audio score, video score, interview score, or candidate score.
10. Frame-, sample-, or segment-level data is retained only long enough to calculate approved aggregates.

The scientific basis for refusing facial-emotion inference is not merely cautionary copy. A major review found substantial context and population variability and challenged reliable, universal inference of emotion from facial movements ([Barrett et al., 2019](https://doi.org/10.1177/1529100619832930)). These boundaries are therefore part of the algorithm contract.

## 2. Availability and calculation quality

Every metric uses:

- `available`: prerequisites met and minimum valid samples reached;
- `partial`: a value exists but capture was interrupted or quality limits are material;
- `unavailable`: prerequisites failed or user declined;
- `calculationQuality: adequate | limited`: quality of the calculation from captured input, never a psychological or personal confidence label;
- `limitations[]`: human-readable causes.

### Minimums

| Data type | Minimum for an available aggregate | Otherwise |
| --- | --- | --- |
| Answer clock | Valid state start and stop timestamps | Unavailable |
| Audio level | 100 valid RMS samples (5 seconds at 20 Hz) | Partial/unavailable |
| Speech segmentation | 5 seconds of valid audio and a valid calibration | Partial/unavailable |
| WPM | Reviewed transcript ≥10 words and speaking duration ≥5 seconds | Unavailable |
| Face/video percentage | 20 processed frames | Partial/unavailable |
| Centring | 20 frames with a primary face | Partial/unavailable |
| Orientation | Adequate calibration plus 20 valid oriented frames | Partial/unavailable |
| Brightness | 20 valid pixel samples | Partial/unavailable |
| Non-exact transcript similarity | Both transcripts ≥20 words | Similarity unavailable; exact match may still be reported |

## 3. Shared timing and sampling rules

- Use `performance.now()` for elapsed calculations.
- Store wall-clock ISO timestamps only for display/audit.
- Do not derive elapsed time from interval ticks.
- A hidden/suspended page gap greater than 5 seconds marks capture partial. By default, active capture is stopped rather than continuing as background recording.
- All durations are integer milliseconds rounded at finalization.
- Percentages are `100 × numerator / denominator`, rounded to one decimal for display but retained at higher precision internally.
- Divide-by-zero yields unavailable, never `0%`.
- “0 detected” and “not measured” are different states.

## 4. Audio signal foundation

### 4.1 Input

Use `AnalyserNode.getFloatTimeDomainData()` at a 20 Hz observation cadence with `fftSize = 2048`. `AnalyserNode` is designed to expose real-time time/frequency data without altering the audio stream ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)).

For sample window \(i\) with \(N\) normalized float samples \(x_n \in [-1,1]\):

\[
\mathrm{RMS}_i = \sqrt{\frac{1}{N}\sum_{n=1}^{N}x_n^2}
\]

\[
\mathrm{dBFS}_i = 20\log_{10}(\max(\mathrm{RMS}_i,10^{-7}))
\]

Clamp displayed dBFS to `[-100, 0]`.

Reject a window when:

- any input is non-finite;
- no audio track is live;
- all windows remain exact zero through a 2-second validation interval; or
- the AudioContext is suspended and cannot resume after one explicit user action.

### 4.2 Calibration and voice activity

During device check, invite but do not require one second of ordinary room sound followed by a short spoken phrase. If no device-check calibration exists, calibrate the first second of answer audio and mark initial delay calculation quality as limited.

1. `noiseFloorDbfs` = median dBFS of presumed non-speech calibration windows.
2. `speechThresholdDbfs` = clamp(`noiseFloorDbfs + 10`, `-50`, `-25`).
3. Speech attack = at least 3 consecutive above-threshold windows at 20 Hz (150 ms).
4. Speech release = at least 5 consecutive below-threshold windows (250 ms).
5. Merge adjacent speech segments separated by <300 ms.
6. Ignore segments <250 ms as isolated noise unless adjacent merging makes them valid.

Calibration is `noisy` if noise floor >−35 dBFS or if >40% of calibration windows exceed the provisional threshold. It is `invalid` for all-zero, non-finite, or near-continuous clipping.

Automatic gain control, noise suppression, microphones, rooms, assistive devices, speech differences, and browsers can alter these values. Voice activity means “signal above an adaptive threshold,” not linguistic speech certainty.

## 5. Audio metric table

| Metric | Purpose and input | Calculation and units | Suggested descriptive thresholds | Confidence limitations and accessibility risks | User-facing interpretation and failure | Coaching influence |
| --- | --- | --- | --- | --- | --- | --- |
| **Answer duration** | Show how long the Answering state lasted. Input: monotonic start/stop. | `stopMs − startMs`; milliseconds, displayed `m:ss`. If a detected suspension gap occurs, retain elapsed value but mark partial. | Compare only with the user's selected target. Flexible mode: `within target`, `past target`; untimed: duration only. No population norm. | Sleep/tab suspension can inflate elapsed time. Some users need more time; timing is adjustable/disableable. | `Your answer lasted 1:42.` Partial: `The duration includes an interruption and may be inaccurate.` Failure: `Answer duration was not available.` | May inform a **length/timing suggestion** only. Never changes content evidence. |
| **Delay before detected speech** | Describe time between Answering start and first threshold-qualified segment. Input: state clock + speech segments. | First segment start offset; milliseconds/seconds. Unavailable if no segment or invalid calibration. | Purely descriptive. Optional condition hints: `<0.5 s`, `0.5–3 s`, `>3 s`; never “too slow.” | VAD may miss quiet speech, AAC, sign, atypical speech, or noise. Preparation may continue after Answering starts. | `Sound above the session threshold was first detected after about 2.1 seconds.` Always include `This may reflect setup or speech-detection limits.` | Does not affect answer feedback. May support user-controlled timing review only. |
| **Speaking duration** | Approximate how much of the answer contained threshold-qualified signal. Input: merged speech segments. | Sum of segment durations; milliseconds/seconds. | No good/bad threshold. Display with answer duration and sample quality. | Does not identify language or communicative intent. May exclude quiet speech and include noise. Risks disadvantaging speech disabilities/AAC. | `Approximately 1:18 contained sound classified as speech activity.` Failure: `Speaking time could not be estimated from this signal.` | Does not affect content ratings. Needed only to calculate approximate WPM. |
| **Silence duration** | Describe non-speech-classified time in the Answering interval. | `max(0, answerDuration − speakingDuration)`; includes initial and trailing time. | No good/bad threshold. | Same VAD limitations. Silence can be intentional, disability-related, reflective, or caused by equipment. | `Approximately 24 seconds did not cross the speech-activity threshold.` Never use `awkward silence`. | No content influence. Optional neutral practice note only when user enabled timing coaching. |
| **Longest internal silence** | Help a user locate an internal pause they may wish to review. Input: gaps between first and last valid speech segments. | Maximum gap between consecutive merged segments; excludes delay before first and time after last; milliseconds/seconds. | Do not label a pause negative. UI may offer markers at `≥2 s` and `≥5 s` for playback navigation only. | VAD errors, noise suppression, deliberate pauses, AAC, breathing, or lost audio. | `The longest estimated pause between detected speech segments was about 3.4 seconds.` Failure: `Internal pauses were not available.` | No content influence. No suggestion unless user opted into pause review. |
| **Average microphone level** | Describe captured signal energy/setup. Input: valid RMS windows. | Energy mean: `sqrt(mean(RMS_i²))`, then dBFS; not arithmetic mean of dB values. | Setup-only bands: `<−45 dBFS` low captured signal; `−45 to −12` signal detected; `>−12` high/possible clipping. Thresholds are device-specific. | Not comparable across devices; AGC, distance, room, voice, disability, and browser processing dominate. Must not become a “speaking volume” judgment. | `Average captured level was about −28 dBFS on this device.` Add: `This describes the recording setup, not how you communicate.` | May suggest checking microphone distance/settings. Never content or personal rating. |
| **Peak microphone level** | Flag potential clipping/setup issue. Input: dBFS windows. | 95th percentile dBFS, not raw maximum, to reduce spike sensitivity. | `>−3 dBFS` possible clipping; otherwise no label. | Browser processing and brief noises can cause peaks. | `Some samples were close to the recording limit; review for distortion.` | Setup suggestion only. |
| **Approximate words per minute** | Let user review pace when both transcript and speech timing exist. Input: reviewed word count + speaking duration. | `wordCount / (speakingDurationMs / 60,000)`; WPM. Require ≥10 words and ≥5 s speech. | Broad reference only: `<90` slower measured pace; `90–190` broad conversational range; `>190` faster measured pace. User may hide these bands. | Recognition/edit mismatch, pauses excluded, language, disability, AAC, accent, individual style, and task affect pace. Not fluency or competence. | `Approximate pace: 136 words per minute, based on the reviewed transcript and detected speaking time.` Failure identifies missing prerequisite. | May produce a **pace-style** suggestion. Cannot change content categories or overall summary strength. |

## 6. Video signal foundation

### 6.1 MediaPipe status

The web Face Landmarker returns normalized landmarks and optional transformation matrices. Google documents synchronous video inference and recommends moving it to a worker because it blocks the calling thread ([Google AI Edge](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)). The solution is a preview. FairScreen therefore:

- runs it only after camera-analysis opt-in;
- uses a worker;
- targets 8 fps rather than every camera frame;
- configures at most two faces;
- turns blendshapes off;
- discards landmarks/matrices in the worker; and
- disables video metrics without blocking practice if initialization/inference fails.

### 6.2 Primary face geometry

For the selected face's normalized landmarks:

```text
minX = min(x); maxX = max(x)
minY = min(y); maxY = max(y)
width = maxX - minX
height = maxY - minY
centerX = (minX + maxX) / 2
centerY = (minY + maxY) / 2
areaRatio = width * height
```

Reject geometry when any coordinate is non-finite, width/height ≤0, or bounds are implausibly outside `[-0.10, 1.10]`.

When two face-like regions are returned, count the multi-face condition and choose the largest area as primary unless the previous frame's primary centre provides a closer continuity match within a 20% area tolerance. This is geometric continuity, not identity tracking. No identifier is retained.

### 6.3 Default thresholds

| Parameter | Default | Purpose |
| --- | --- | --- |
| Horizontal centring tolerance | `abs(centerX − .50) ≤ .18` | Broad central region |
| Vertical centring target/tolerance | `abs(centerY − .45) ≤ .20` | Allows head above geometric centre |
| Edge threshold | `minX/minY ≤ .02` or `maxX/maxY ≥ .98` | Possible clipping/partial framing |
| Workable face area | `.07 ≤ areaRatio ≤ .42` | Broad setup band |
| Near-camera yaw delta | `≤18°` absolute | Relative to calibration |
| Near-camera pitch delta | `≤15°` absolute | Relative to calibration |
| Dim mean luma | `<.22` | Approximate exposure category |
| Bright mean luma | `>.78` | Approximate exposure category |
| High dynamic spread | `p90 − p10 >.65` | Possible uneven exposure |
| Possible backlight | background mean `>.60` and background−central/face region `>.25` | Experimental, limited-quality condition |

These values require test-fixture verification and remain configuration/version values, not user performance standards.

### 6.4 Approximate orientation

Orientation is available only if:

1. the selected MediaPipe version returns a validated facial transformation matrix;
2. test fixtures establish the matrix layout, handedness, and Euler conversion;
3. the user completes a neutral calibration; and
4. at least 20 stable oriented frames exist.

Compute yaw/pitch from the orthonormalized 3×3 rotation portion using the implementation's documented convention. Record median calibration yaw/pitch. Each answer frame uses:

```text
yawDelta = wrapDegrees(currentYaw - baselineYaw)
pitchDelta = wrapDegrees(currentPitch - baselinePitch)
nearCamera = abs(yawDelta) <= 18 && abs(pitchDelta) <= 15
```

Use median filtering across a 5-sample rolling window. If gimbal lock, non-orthonormal matrix, unstable calibration (median absolute deviation >10°), or layout uncertainty occurs, orientation is unavailable. Do not substitute iris direction, facial expression, or an unvalidated landmark ratio.

## 7. Video metric table

| Metric | Purpose and input | Calculation and units | Suggested descriptive thresholds | Confidence limitations and accessibility risks | User-facing interpretation and failure | Coaching influence |
| --- | --- | --- | --- | --- | --- | --- |
| **Face-detection percentage** | Describe how often the selected model returned ≥1 face-like landmark set. Input: valid processed frames. | `100 × framesWithFace / processedValidFrames`. Require 20 frames. | Descriptive bands for setup copy only: `<50%` inconsistent detection; `50–89.9%` detected in some/most samples; `≥90%` detected in nearly all samples. | Detection varies with appearance, movement, disability, assistive devices, occlusion, lighting, camera, model, and backgrounds. Not facial visibility quality or participation. | `A face-like shape was detected in 82% of sampled frames.` Low/none: suggest only checking preview if the user wants. | Video-call condition panel only. Never answer coaching. |
| **Single-face percentage** | Distinguish exactly one returned region from multiple. | `100 × framesFaceCountEquals1 / processedValidFrames`. | No positive target; provided for transparency. | False positives from posters/screens and false negatives. | `Exactly one face-like region was returned in 76% of samples.` | None. |
| **Multiple-face percentage** | Describe when the model returned ≥2 regions, capped by `numFaces: 2`. | `100 × framesFaceCountAtLeast2 / processedValidFrames`. | No misconduct threshold. If >0, show neutral note. | Does not identify people; posters/screens/images may trigger it; model cap hides counts >2. Risk of surveillance/proctoring interpretation. | `More than one face-like region was returned in 4% of samples. Background images or screens can affect this.` | None; cannot trigger warning about cheating or integrity. |
| **Reasonable centring percentage** | Describe whether primary face-box centre fell in a broad centre guide. Denominator: valid face frames. | `100 × centredFaceFrames / validPrimaryFaceFrames`, using default x/y tolerances. | No score. Suggested copy: `<50%` often outside guide; `50–79.9%` varied; `≥80%` often within broad guide. | Camera angle, mobility, posture, framing preference, assistive devices, and movement affect it. Centre is not better communication. | `The detected face position was within the broad centre guide in 68% of face-detected samples.` | Optional setup framing suggestion only. |
| **Approximate yaw/pitch** | Describe relative head-orientation change from user's own calibration. | Per-frame yaw/pitch deltas in degrees; report medians and distribution, not a moment-by-moment trace. | No universal ideal. Technical near-camera band uses ±18° yaw and ±15° pitch. | Matrix semantics/version, calibration, camera position, disability, natural movement, and screen/camera offset. Not gaze or attention. | `Median estimated orientation differed from calibration by 9° horizontally and 6° vertically.` | Conditions panel only. |
| **Near-camera-orientation percentage** | Describe how often validated orientation fell inside the broad relative band. | `100 × nearCameraFrames / validOrientationFrames`. Require calibration +20 frames. | Do not use pass/fail. Copy bands may use `less often`, `varied`, `often`, without a preferred percentage. | Does not know eye direction or visual target. Looking at screen/question is normal. May be unavailable for users/model outputs. | `Estimated head orientation was within the broad near-camera band in 43% of measured samples. This is not an eye-contact or attention measure.` | May explain camera/display geometry. Never content feedback. |
| **Camera framing condition** | Describe face size and possible edge clipping. Input: landmark bounding geometry. | Per frame: `edge-or-partial` first if bounds near edge; else `too-far` area<.07; `too-close` area>.42; else `workable`; `no-face`/`unknown`. Aggregate category counts and dominant category only when ≥50%; otherwise `varied`. | Broad defaults above. No grade. | Bounding boxes vary with head shape, pose, hair, covering, assistive equipment, model, and camera aspect ratio. “Workable” means within product guide, not correct. | `Framing appeared workable in 61% of face-detected samples and varied in the rest.` Failure: `Framing was not available because a face shape was not consistently detected.` | Optional setup suggestion only. |
| **Approximate brightness category** | Describe sampled pixel exposure, not a person's face. Input: downsampled RGB frame; optional broad central/background regions. | Relative luma `Y=.2126R+.7152G+.0722B` normalized 0–1. Order: possible backlighting; dim; bright; uneven; balanced. Aggregate distribution. | Dim `<.22`; bright `>.78`; spread `>.65`; possible backlight as default table. Thresholds configurable/versioned. | Camera auto-exposure/HDR, skin tone, background, clothing, monitor, colour pipeline, and room affect result. Regional backlight check has particular skin-tone risk and must remain experimental with limited calculation quality. | `Sampled frames were most often categorized as dim.` or `Possible backlighting was detected in some samples; review the preview rather than treating this as a precise result.` | Optional lighting/setup suggestion only. Never face quality or content. |
| **Sampling quality / dropped frames** | Make performance limits transparent. Input: requested, processed, dropped, invalid counts. | `dropPct=100×dropped/(processed+dropped)` plus effective Hz. | `<20%` adequate; `20–49.9%` limited calculation quality; `≥50%` video metrics partial. | Slow devices, browser scheduling, model load, tab state. | Technical details: `42% of requested samples were skipped to keep controls responsive.` | Determines calculation quality/availability only, never user coaching. |

## 8. Video category precedence

### Per-frame framing

```text
if no valid primary face => no-face-detected
else if near any frame edge => edge-or-partial
else if areaRatio < .07 => too-far
else if areaRatio > .42 => too-close
else => workable
```

### Per-frame brightness

```text
if pixel sample invalid => unknown
else if possibleBacklightingCondition => possible-backlighting
else if meanLuma < .22 => dim
else if meanLuma > .78 => bright
else if p90Luma - p10Luma > .65 => uneven
else => balanced
```

The regional backlight condition must be behind a feature flag until tests across diverse skin tones/backgrounds show the wording and false-positive rate are acceptable. If not validated, remove that calculated category while retaining user-authored condition labels and whole-frame brightness. This is a responsible fallback, not a missing core feature.

## 9. Deterministic transcript preprocessing

The answer analyzer operates only on the active reviewed transcript.

### 9.1 Normalization

Create two forms:

- **display/original:** exact reviewed text;
- **analysis form:** Unicode NFKC, lowercase, normalized apostrophes/dashes, collapsed whitespace.

Preserve a character-offset map from analysis tokens to original text so evidence can show the user's actual words.

### 9.2 Tokenization

- Use a versioned local Unicode-aware tokenizer, not browser-dependent `Intl.Segmenter`.
- Recognize letters/numbers and approved technology characters (`+`, `#`, `.`, `/`, hyphen, apostrophe).
- Maintain a reviewed English stop-word list.
- Use a conservative suffix normalizer only for tokens longer than five letters; never stem proper technology names.
- Sentence split at `.?!` plus paragraph breaks, with a small abbreviation allowlist.
- Count contractions as one word.
- No sentiment analysis, grammar correction, spell checking, accent inference, or vocabulary-prestige metric.

### 9.3 Shared evidence marker classes

- `number-with-context`: number plus %, currency, unit, date, duration, count, or before/after phrase.
- `time-or-setting`: when, during, at the time, in my role, on a project, while, after, before.
- `constraint`: deadline, limited, unavailable, required, risk, issue, problem, conflict.
- `first-person-action`: `I`/`my` within six tokens of a reviewed action verb.
- `outcome`: as a result, led to, reduced, increased, resolved, completed, delivered, learned, changed, prevented.
- `task`: needed to, responsible for, goal, objective, had to, was asked to.
- `tool/artifact`: context keyword/lexicon term or concrete artifact such as report, API, test, case, ticket, database, document.

Lexicons are versioned data with tests. A marker is evidence of wording, not proof that the described event occurred.

## 10. Answer-analysis heuristic table

| Category | Applicability and calculation | Ratings | User-facing language and limitations | Cross-category effect |
| --- | --- | --- | --- | --- |
| **Question relevance** | Build weighted intent terms from question literal content, template tags, and rendered role keywords. Coverage=`matchedWeight/totalWeight`; template-specific intent anchors handle generic questions. Require ≥2 analyzable terms or a defined intent map. | `strong`: coverage≥.55 and ≥2 matches, or intent map satisfied. `developing`: .25–.549. `needs more evidence`: <.25. `not available`: transcript <15 words or no analyzable intent. | `The transcript appears to address…` Show matched spans. `Keyword overlap is a limited proxy; an answer can be relevant with different wording.` | Independent. No video/audio input. |
| **Specificity** | Count distinct classes among time/setting, constraint, named tool/artifact, role/person/team, concrete action object, contextual measurement. | `strong`: ≥3 classes. `developing`: 1–2. `needs more evidence`: 0. `not available`: <15 words. | `The transcript appears to include a concrete tool and time context.` Missing: `Consider adding where this happened, the constraint, or a concrete detail.` | Independent. Numbers not required. |
| **Concrete example** | Applicable to behavioural/event questions. Detect event/time context + problem/constraint + action evidence. | `strong`: all 3. `developing`: any 2. `needs more evidence`: 0–1. `not applicable`: introduction, motivation, knowledge, or explicitly hypothetical prompts. | `A specific past example appears to be present.` or `A clear event was not detected; consider naming one situation.` | Does not force STAR on non-behavioural questions. |
| **Personal contribution** | Count first-person action clauses and collaboration-distinction cues (`my part`, `I was responsible`, `the team… I…`). | `strong`: ≥3 first-person action clauses, or ≥2 plus distinction cue. `developing`: 1–2. `needs more evidence`: 0 in applicable answer. `not available`: <15 words. | `The transcript appears to distinguish your actions from the team's work.` Do not penalize culturally collaborative language; suggestion is optional. | Independent. |
| **Result or outcome** | Detect an explicit result cue with a consequence clause, or a concrete outcome verb/object near answer end. | `strong`: explicit linked outcome. `developing`: outcome language is present but vague/unlinked. `needs more evidence`: not detected. `not applicable`: some values/knowledge questions. | `A specific outcome appears in…` or `A specific outcome was not detected. Consider stating what changed, what was delivered, or what you learned.` | Independent. |
| **Measurable evidence** | Applicable when an outcome can reasonably be quantified and confidentiality permits. Detect number-with-context or explicit before/after comparison. | `strong`: ≥1 contextual measurement or before/after comparison. `developing`: qualitative scale (`faster`, `fewer`, `improved`) without context. `needs more evidence`: none when applicable. `not applicable`: motivation, ethics, reflection, confidential or non-quantifiable contexts. | `The transcript appears to include measurable evidence.` Always note that numbers are optional and should not disclose confidential information. | Never required for overall summary. |
| **Possible STAR structure** | Behavioural questions only. Detect Situation, Task, Action, Result independently using marker sets. | `strong`: 4/4. `developing`: 3/4. `needs more evidence`: 0–2. `not applicable`: non-behavioural/hypothetical prompts. | `Possible STAR elements detected: Situation, Action, Result. A separate task/responsibility was not detected.` This is a scaffold, not validation. | Independent; no numeric total displayed beyond elements. |
| **Excessive repetition** | Require ≥30 words. Generate normalized 3–6-word n-grams, excluding stop-word-only grams. A repeated phrase counts when it appears ≥3 times. Extra-repeat ratio=`tokens in occurrences after first / wordCount`. | `strong`: ratio≤.04. `developing`: >.04; add stronger suggestion when >.10. `not available`: <30 words. Never `needs more evidence`. | `One repeated phrase appeared several times.` Evidence highlights phrase. Repetition can be rhetorical or transcript error. | Style only; cannot reduce content evidence. |
| **Filler language** | Require ≥30 words. Versioned phrase list: `um`, `uh`, `you know`, `sort of`, `kind of`, and contextual uses of `basically`/`actually`. Count `like` only in tightly defined discourse patterns; browser transcripts may omit fillers. Rate per 100 words. | `strong`: ≤2/100. `developing`: >2/100; stronger optional note >6/100. `not available`: source likely strips fillers or <30 words. | `The reviewed transcript contains approximately 4 listed filler phrases per 100 words. Automatic transcripts may omit these.` | Style only. User may disable. |
| **Length** | Require reviewed transcript. Timed target words=`clamp(answerTimeMinutes×130,40,300)`; lower=.5×target, upper=1.35×target. Untimed uses word count without preferred target unless user sets one. | `<30 words`: `needs more evidence` for content practice. Within band: `strong`. Outside band: `developing`. Untimed: `not applicable` unless target chosen. | `This 112-word answer is within your selected two-minute practice range.` Never “too long/short” as personal judgment. | Style only; content categories still independent. |
| **Speaking pace** | Use approved WPM metric; prerequisites apply. | `strong`: 90–190 WPM broad reference. `developing`: outside; `not available`: prerequisites fail. User may hide reference bands. | `This is a broad playback aid, not a fluency or competence rating.` Encourage listening rather than speed correction. | Timing style only. |
| **Clarity and concision** | Conservative text proxies: sentence mean 8–28 words, no sentence >45, extra-repeat ratio≤.10, and ≤1 unresolved fragment flag per 100 words. Do not grammar-score. | `strong`: no proxy flags. `developing`: 1–2 flags. `needs more evidence`: ≥3 flags or <15 words where meaning is incomplete. `not available`: segmentation unreliable. | `The transcript appears concise under these limited text checks.` or `One sentence is long enough that splitting it may make the sequence easier to follow.` May be incomplete for style/dialect. | Style only; does not overwrite other content evidence. |

### 10.1 Rating summary rules

- Do not map ratings to numbers.
- Do not average ratings.
- Do not select a “best answer” automatically.
- Overall coaching summary may count the presence of categories across reviewed responses, for example “Outcomes were detected in 1 of 3 answers.”
- `Strong` means the versioned wording heuristic found its evidence, not that the candidate or answer is objectively strong.
- Category evidence is shown on request and links to original transcript spans.

## 11. Fairness Lab transcript similarity

### 11.1 Comparison normalization

For similarity only:

1. Unicode NFKC.
2. Lowercase.
3. Normalize apostrophes/dashes.
4. Remove punctuation except characters internal to recognized technology terms.
5. Collapse whitespace.
6. Retain stop words because the goal is answer-text similarity, not topic classification.
7. Create term-frequency unigram vectors and ordered word trigrams.

### 11.2 Components

Cosine unigram similarity:

\[
\cos(A,B)=\frac{A\cdot B}{\|A\|\|B\|}
\]

Trigram Jaccard:

\[
J(A,B)=\frac{|T_A\cap T_B|}{|T_A\cup T_B|}
\]

Weighted similarity:

\[
S=0.60\cos(A,B)+0.40J(A,B)
\]

Word-count difference:

\[
D=100\times\frac{|w_A-w_B|}{\max(w_A,w_B)}
\]

### 11.3 Bands

| Band | Deterministic rule | UI consequence |
| --- | --- | --- |
| **Exact** | Normalized strings are equal. | Approved invariance statement may display. |
| **Substantially unchanged** | Both ≥20 words; `S ≥ .85`; `D ≤15%`; contextual number/entity sets have no contradiction; relevance, specificity, contribution, and outcome ratings differ by no more than one adjacent label and none changes to/from `not available`. | Approved invariance statement may display with component details. |
| **Similar** | Both ≥20 words; `S ≥ .70`; `D ≤30%`. | Show `Related but changed`; no invariance statement. |
| **Different** | Both analyzable but rules above fail. | Warn that condition-only comparison is not supported. |
| **Unavailable** | Missing/unreviewed transcript, or a non-exact pair has <20 words. | Show trials separately; no content-holding claim. |

For 3+ trials, calculate all unique pairs. `allContentInvariant` is true only if every pair is Exact or Substantially unchanged.

When `allContentInvariant` is true, use this exact statement on screen and in print, plain-text, and JSON representations:

> The answer content remained unchanged. Differences in video conditions should not be interpreted as differences in competence.

### 11.4 Contradiction guard

Extract versioned high-signal items:

- numbers plus units;
- negation within four tokens of an action/outcome;
- named job-context technologies/artifacts;
- explicit outcome verbs.

If one transcript materially negates or changes a high-signal result, cap the band at Similar even when surface similarity is high. This is a conservative guard, not semantic understanding. The UI must say that deterministic similarity can miss meaning changes.

## 12. Seeded demonstration data

### Question

`Tell me about a time you solved a difficult problem. What did you personally do?`

### Identical synthetic transcript

`In a class scheduling project, users were sometimes seeing duplicate appointments after a slow network response. I reproduced the issue, traced it to two requests updating the same local record, and added an idempotency check before the save. I also wrote a regression test that simulated the delayed response. The duplicate rate in our test run went from 7 out of 50 attempts to zero, and the test stayed in the automated suite so the issue would be caught before future releases.`

This is fictional demo copy and must be labeled synthetic.

### Aggregate trial fixtures

| Condition | Face detection | Centring | Near-camera orientation | Framing | Brightness | Content |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Near-camera setup | 98% | 94% | 88% | 92% workable | 86% balanced | Identical |
| Looking at displayed question | 96% | 84% | 42% | 90% workable | 84% balanced | Identical |
| Side-positioned camera | 90% | 38% | 31% | 56% edge/partial | 78% balanced | Identical |
| Dim lighting | 67% | 73% | 70% | 75% workable | 88% dim | Identical |

Each fixture includes ≥100 synthetic processed frames and a clear `seeded-demo` source. No fake frame, face, audio, or recording is stored.

## 13. Wording catalogue

### Approved

- `The transcript appears to include…`
- `A specific outcome was not detected.`
- `Consider adding…`
- `This analysis may be incomplete.`
- `A face-like shape was detected…`
- `The detected position was within the broad centre guide…`
- `Estimated head orientation was near the calibration range…`
- `The sampled frames were most often categorized as dim.`
- `This describes the captured setup, not your competence.`
- `Not available because…`

### Prohibited

- `You looked confident/nervous/honest/dishonest/engaged/distracted.`
- `Good/bad eye contact.`
- `Your emotion/personality is…`
- `You seem employable / a strong candidate.`
- `Suspicious movement / multiple people detected.`
- `Professional face/voice/appearance.`
- `Native/fluent sounding.`
- `Pass/fail camera score.`
- `Ideal candidate pace.`

## 14. Failure behaviour matrix

| Failure | Metrics kept | Metrics unavailable | Required result |
| --- | --- | --- | --- |
| Microphone denied | Answer clock, reviewed transcript analysis | All audio signal metrics/WPM based on speech time | Camera-free/mic-free flow continues. |
| AudioContext failure | Answer clock, transcript | Level, segmentation, WPM | Offer timing-only/manual transcript. |
| Signal all zero | Answer clock, transcript | Audio signal metrics | Say signal could not be validated; do not call it silence. |
| Camera denied | Audio/content as selected | All video metrics | Interview and seeded demo continue. |
| MediaPipe init failure | Preview may remain, audio/content | Video metrics | Mark unavailable; stop worker attempts after one safe retry. |
| Worker interruption after samples | Audio/content; partial video values if minimum met | Any video metric below prerequisites | Mark partial and report counts. |
| Orientation matrix unvalidated | Other video metrics | Yaw/pitch and near-camera orientation | Do not substitute eye landmarks. |
| Speech recognition unsupported/failed | Timing/audio/video | Automatic transcript | Manual editor appears; reviewed manual text enables analysis. |
| Transcript unreviewed | Timing/audio/video | All content heuristics/WPM | Require review or timing-only choice. |
| Storage write fails | In-memory finalized metrics while page open | Persistence | Offer export/discard; never claim saved. |

## 15. Test vectors required

### Audio

- Synthetic silence, constant tone, speech-like bursts, high noise floor, clipping, all-zero stream.
- Exact attack/release boundary windows.
- Initial/trailing silence excluded correctly from longest internal silence.
- Sleep/suspension gap marks partial.
- WPM prerequisite and rounding boundaries.

### Video

- No face, one face, two faces, false-like background fixture.
- Bounding centres exactly inside/outside tolerance.
- Area and edge boundary equality.
- Brightness at each threshold.
- Backlight feature flag off/on.
- Matrix convention fixtures for yaw/pitch, gimbal/invalid matrices, unstable calibration.
- Worker backlog/drop thresholds.
- Assertion that output contains no landmarks/matrix/image/pixel fields.

### Content

- Positive, negative, ambiguous, and too-short fixtures for every category.
- Confidential number that should be recognized but not encouraged for export.
- Collaborative answer without first-person dominance.
- Non-behavioural question produces STAR `not applicable`.
- Transcript recognition error demonstrates cautious wording.
- Dialect/style fixtures prevent grammar or prestige scoring.
- Exact boundary values for coverage, marker counts, WPM, length, repetition, and filler rates.

### Fairness

- Exact normalized punctuation/case difference.
- Substantial paraphrase above threshold.
- High lexical similarity with contradictory number/result capped at Similar.
- Short non-exact transcripts unavailable.
- Every-pair rule for 3+ trials.
- Video fixture changes do not alter any content output.

## 16. Measurement release gate

- [ ] Every metric output has status, sample count/prerequisites, algorithm version, limitations, and safe wording.
- [ ] Exact calculations and thresholds have unit tests.
- [ ] Face landmarks/matrices never cross the worker observation boundary.
- [ ] Raw audio arrays never cross the analyzer boundary.
- [ ] Orientation is disabled unless matrix convention and calibration are validated.
- [ ] Backlight calculation is disabled if diverse-fixture review is not acceptable.
- [ ] No metric is averaged into a score.
- [ ] Content analysis compiles and tests without importing video types.
- [ ] WPM, filler, pause, length, and clarity cannot change evidence categories.
- [ ] The seeded demo produces the exact invariance message.
- [ ] Failure states distinguish zero, missing, denied, partial, and unsupported.
