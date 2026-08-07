# FairScreen TypeScript Domain Models

**Version:** 1.0  
**Status:** Normative model contract  
**Compiler assumptions:** TypeScript strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`

## 1. Modelling rules

- Domain files are framework- and browser-independent.
- No `any`, DOM objects, MediaStream, ImageBitmap, AudioBuffer, face landmark, matrix, pixel, PCM, or Blob appears in domain persistence models.
- Times stored across sessions are ISO-8601 UTC strings. In-session durations use integer milliseconds.
- Percentages use numbers from 0 through 100.
- Normalized ratios use numbers from 0 through 1 and include `Ratio` in the name.
- Identifiers are branded strings to prevent cross-aggregate assignment.
- Immutable `readonly` values are the default.
- Optional properties are omitted when absent rather than set to `undefined`.
- All persisted records include schema and algorithm versions.
- Runtime validation is required at input, worker, persistence, and import/export boundaries; TypeScript alone is not validation.

## 2. Common types

```ts
export type Brand<Value, Name extends string> = Value & {
  readonly __brand: Name;
};

export type IsoDateTime = Brand<string, "IsoDateTime">;
export type IsoDate = Brand<string, "IsoDate">;
export type Sha256Digest = Brand<string, "Sha256Digest">;

export type InterviewSessionId = Brand<string, "InterviewSessionId">;
export type InterviewQuestionId = Brand<string, "InterviewQuestionId">;
export type QuestionTemplateId = Brand<string, "QuestionTemplateId">;
export type QuestionResponseId = Brand<string, "QuestionResponseId">;
export type TranscriptRevisionId = Brand<string, "TranscriptRevisionId">;
export type RecordingId = Brand<string, "RecordingId">;
export type FairnessTrialId = Brand<string, "FairnessTrialId">;
export type FairnessComparisonId = Brand<string, "FairnessComparisonId">;
export type FairnessGroupId = Brand<string, "FairnessGroupId">;
export type UserSettingsId = Brand<string, "UserSettingsId">;

export type Milliseconds = Brand<number, "Milliseconds">;
export type Hertz = Brand<number, "Hertz">;
export type DecibelsFullScale = Brand<number, "DecibelsFullScale">;
export type WordsPerMinute = Brand<number, "WordsPerMinute">;
export type Percentage = Brand<number, "Percentage">;
export type NormalizedRatio = Brand<number, "NormalizedRatio">;
export type Degrees = Brand<number, "Degrees">;
export type ByteCount = Brand<number, "ByteCount">;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface AlgorithmVersions {
  readonly questionProvider: string;
  readonly keywordExtractor: string;
  readonly audioMetrics: string;
  readonly videoMetrics: string;
  readonly answerHeuristics: string;
  readonly fairnessSimilarity: string;
}

export interface VersionedRecord {
  readonly schemaVersion: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export type AvailabilityReason =
  | "not-requested"
  | "permission-denied"
  | "permission-blocked"
  | "unsupported"
  | "initialization-failed"
  | "device-lost"
  | "insufficient-samples"
  | "invalid-signal"
  | "missing-transcript"
  | "user-declined"
  | "storage-failed"
  | "interrupted"
  | "unknown";

export type MetricValue<Value> =
  | {
      readonly status: "available";
      readonly value: Value;
      readonly calculationQuality: "adequate" | "limited";
      readonly limitations: readonly string[];
    }
  | {
      readonly status: "partial";
      readonly value: Value;
      readonly calculationQuality: "limited";
      readonly limitations: readonly string[];
      readonly reason: AvailabilityReason;
    }
  | {
      readonly status: "unavailable";
      readonly reason: AvailabilityReason;
      readonly limitations: readonly string[];
    };

export interface EvidenceSpan {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly evidenceType:
    | "keyword"
    | "example-cue"
    | "action-cue"
    | "outcome-cue"
    | "measurement"
    | "repetition"
    | "filler"
    | "structure-cue";
}

export function milliseconds(value: number): Milliseconds {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("Milliseconds must be a non-negative safe integer.");
  }
  return value as Milliseconds;
}
```

Runtime factories must validate brands before the one contained assertion. Define equivalent bounded factories for percentages, ratios, dates, IDs, hertz, dBFS, WPM, degrees, and byte counts. Do not cast unchecked values directly.

## 3. Interview settings and context

```ts
export type InterviewCategory =
  | "general-behavioural"
  | "software-technical"
  | "customer-service"
  | "leadership"
  | "investigative"
  | "custom-mixed";

export type InterviewDifficulty =
  | "foundational"
  | "standard"
  | "advanced";

export type TimingMode = "flexible" | "strictPractice" | "untimed";

export type TranscriptionPreference =
  | "ask-when-supported"
  | "manual"
  | "timing-only";

export type LiveCoachingPreference =
  | "off"
  | "delivery-timing"
  | "answer-structure"
  | "both";

export interface InterviewSettings {
  readonly questionCount: number;
  readonly preparationTimeMs: Milliseconds;
  readonly answerTimeMs: Milliseconds;
  readonly timingMode: TimingMode;
  readonly extensionTimeMs: Milliseconds;
  readonly liveCoaching: LiveCoachingPreference;
  readonly transcription: TranscriptionPreference;
  readonly cameraRequested: boolean;
  readonly microphoneRequested: boolean;
  readonly recordingCaptureRequested: boolean;
  readonly screenReaderTimerAnnouncements: boolean;
}

export interface InterviewContext {
  readonly jobTitle: string;
  readonly company?: string;
  readonly jobDescription?: string;
  readonly resumeText?: string;
  readonly category: InterviewCategory;
  readonly difficulty: InterviewDifficulty;
  readonly locale: string;
}

export interface ExtractedKeyword {
  readonly normalized: string;
  readonly display: string;
  readonly source: "job-title" | "job-description" | "resume";
  readonly weight: number;
  readonly kind: "role" | "skill" | "technology" | "domain" | "responsibility";
}
```

Constraints:

- `questionCount`: 1–10.
- `preparationTimeMs`: 0–600,000.
- `answerTimeMs`: 30,000–1,200,000 unless `untimed`; the value remains a non-binding target in untimed mode.
- `extensionTimeMs`: 10,000–600,000.
- job/company max 120 Unicode code points after trim.
- job description/résumé max 20,000 code points each.
- locale is a validated BCP 47 tag; English content heuristics are enabled only for supported English locales in MVP.

## 4. Question models

```ts
export type QuestionSource =
  | "built-in"
  | "adapted-template"
  | "custom"
  | "fallback";

export type QuestionTag =
  | "introduction"
  | "motivation"
  | "problem-solving"
  | "adaptability"
  | "learning"
  | "conflict"
  | "prioritization"
  | "ownership"
  | "technical-depth"
  | "debugging"
  | "api"
  | "data"
  | "accessibility"
  | "testing"
  | "delivery"
  | "security-privacy"
  | "customer"
  | "communication"
  | "leadership"
  | "investigation"
  | "evidence"
  | "documentation"
  | "confidentiality"
  | "trade-off"
  | "reflection";

export interface QuestionTemplate {
  readonly id: QuestionTemplateId;
  readonly category: Exclude<InterviewCategory, "custom-mixed">;
  readonly difficulty: InterviewDifficulty;
  readonly template: string;
  readonly tags: readonly QuestionTag[];
  readonly allowedTokens: readonly ("jobTitle" | "companyClause" | "keyword")[];
  readonly fallbackText: string;
}

export interface InterviewQuestion {
  readonly id: InterviewQuestionId;
  readonly source: QuestionSource;
  readonly templateId?: QuestionTemplateId;
  readonly text: string;
  readonly normalizedText: string;
  readonly category: InterviewCategory;
  readonly difficulty: InterviewDifficulty;
  readonly tags: readonly QuestionTag[];
  readonly renderedKeywords: readonly ExtractedKeyword[];
  readonly order: number;
  readonly providerId: string;
  readonly providerVersion: string;
}

export interface CustomQuestionInput {
  readonly clientId: string;
  readonly text: string;
  readonly order: number;
}

export interface QuestionGenerationRequest {
  readonly sessionId: InterviewSessionId;
  readonly context: InterviewContext;
  readonly settings: InterviewSettings;
  readonly customQuestions: readonly CustomQuestionInput[];
  readonly excludedNormalizedQuestions: readonly string[];
}

export interface QuestionSelectionReason {
  readonly questionId: InterviewQuestionId;
  readonly reason:
    | "category-match"
    | "difficulty-match"
    | "keyword-adapted"
    | "custom"
    | "fallback";
  readonly details: readonly string[];
}

export interface QuestionGenerationResult {
  readonly questions: readonly InterviewQuestion[];
  readonly extractedKeywords: readonly ExtractedKeyword[];
  readonly selectionReasons: readonly QuestionSelectionReason[];
  readonly warnings: readonly string[];
  readonly providerId: string;
  readonly providerVersion: string;
}
```

## 5. Permission and capability models

The module-scoped `PermissionState` is intentionally broader than the browser's three-value state.

```ts
export type PermissionState =
  | "not-requested"
  | "prompt"
  | "granted"
  | "denied"
  | "blocked"
  | "unavailable"
  | "unknown";

export interface PermissionSnapshot {
  readonly camera: PermissionState;
  readonly microphone: PermissionState;
  readonly capturedAt: IsoDateTime;
  readonly source: "media-request" | "permissions-api" | "capability-scan";
}

export type CapabilityStatus =
  | "supported"
  | "limited"
  | "unsupported"
  | "blocked"
  | "unknown";

export interface CapabilityDetail {
  readonly status: CapabilityStatus;
  readonly label: string;
  readonly reason?: string;
  readonly fallback?: string;
}

export interface RecorderMimeCapability {
  readonly mimeType: string;
  readonly reportedSupported: boolean;
  readonly trialResult: "not-run" | "succeeded" | "failed";
}

export interface SpeechCapability {
  readonly status: CapabilityStatus;
  readonly constructorKind: "standard" | "prefixed" | "none";
  readonly processingMode: "device" | "remote" | "unknown";
  readonly localProcessingControl: "available" | "unavailable" | "unknown";
  readonly disclosureRequired: boolean;
}

export interface StorageCapability {
  readonly indexedDb: CapabilityDetail;
  readonly estimate: CapabilityDetail;
  readonly persistenceRequest: CapabilityDetail;
  readonly estimatedUsageBytes?: ByteCount;
  readonly estimatedQuotaBytes?: ByteCount;
  readonly persistent?: boolean;
}

export interface BrowserCapabilityReport {
  readonly schemaVersion: 1;
  readonly capturedAt: IsoDateTime;
  readonly secureContext: CapabilityDetail;
  readonly mediaDevices: CapabilityDetail;
  readonly deviceEnumeration: CapabilityDetail;
  readonly webAudio: CapabilityDetail;
  readonly mediaRecorder: CapabilityDetail;
  readonly recorderMimeTypes: readonly RecorderMimeCapability[];
  readonly worker: CapabilityDetail;
  readonly webAssembly: CapabilityDetail;
  readonly mediaPipeFaceLandmarker: CapabilityDetail;
  readonly speechRecognition: SpeechCapability;
  readonly storage: StorageCapability;
  readonly print: CapabilityDetail;
  readonly blobDownload: CapabilityDetail;
  readonly limitations: readonly string[];
}
```

Do not store browser user-agent strings in the session record. Cross-browser diagnostics belong in user-initiated, privacy-safe support output.

## 6. Transcript models

```ts
export type TranscriptSource =
  | "browser-speech"
  | "manual"
  | "edited-browser-speech"
  | "none";

export type TranscriptionProcessingMode = "device" | "remote" | "unknown";

export interface RecognitionSegment {
  readonly text: string;
  readonly isFinal: boolean;
  readonly startOffsetMs?: Milliseconds;
  readonly endOffsetMs?: Milliseconds;
}

/** In-memory interview/review state only; never a repository or export payload. */
export interface TransientRecognitionState {
  readonly interimText: string;
  readonly finalText: string;
  readonly segments: readonly RecognitionSegment[];
}

export interface TranscriptRevision {
  readonly id: TranscriptRevisionId;
  readonly createdAt: IsoDateTime;
  readonly text: string;
  readonly source: TranscriptSource;
  readonly reviewedByUser: boolean;
  readonly locale: string;
  readonly wordCount: number;
  readonly normalizedDigest: Sha256Digest;
}

export interface TranscriptResult {
  readonly status:
    | "complete"
    | "partial"
    | "manual"
    | "timing-only"
    | "unavailable";
  readonly providerId: string;
  readonly processingMode: TranscriptionProcessingMode;
  readonly disclosureAcceptedAt?: IsoDateTime;
  readonly activeRevision?: TranscriptRevision;
  readonly revisions: readonly TranscriptRevision[];
  readonly errors: readonly TranscriptionError[];
  readonly limitations: readonly string[];
}

export interface TranscriptionError {
  readonly code:
    | "unsupported"
    | "permission-denied"
    | "no-match"
    | "network"
    | "audio-capture"
    | "service-not-allowed"
    | "aborted"
    | "ended"
    | "unknown";
  readonly recoverable: boolean;
  readonly safeMessage: string;
}
```

Discard provider-reported speech-recognition confidence values. They are not needed for the MVP and must not be displayed or used by content analysis. `TransientRecognitionState` is intentionally absent from `QuestionResponse`; repository/export boundary schemas must reject it.

## 7. Audio metric models

```ts
export interface AudioCalibration {
  readonly sampleCount: number;
  readonly noiseFloorDbfs: DecibelsFullScale;
  readonly speechThresholdDbfs: DecibelsFullScale;
  readonly attackMs: Milliseconds;
  readonly releaseMs: Milliseconds;
  readonly calibrationQuality: "adequate" | "noisy" | "invalid";
}

export interface SpeechSegment {
  readonly startOffsetMs: Milliseconds;
  readonly endOffsetMs: Milliseconds;
}

export interface AudioMetrics {
  readonly algorithmVersion: string;
  readonly status: "complete" | "partial" | "unavailable";
  readonly sampleRateHz: Hertz;
  readonly sampleCount: number;
  readonly invalidSampleCount: number;
  readonly calibration?: AudioCalibration;
  readonly answerDurationMs: MetricValue<Milliseconds>;
  readonly delayBeforeSpeechMs: MetricValue<Milliseconds>;
  readonly speakingDurationMs: MetricValue<Milliseconds>;
  readonly silenceDurationMs: MetricValue<Milliseconds>;
  readonly longestInternalSilenceMs: MetricValue<Milliseconds>;
  readonly averageMicrophoneLevelDbfs: MetricValue<DecibelsFullScale>;
  readonly peakMicrophoneLevelDbfs: MetricValue<DecibelsFullScale>;
  readonly approximateWordsPerMinute: MetricValue<WordsPerMinute>;
  readonly speechSegments: readonly SpeechSegment[];
  readonly warnings: readonly AudioMetricWarning[];
}

export type AudioMetricWarning =
  | "high-noise-floor"
  | "possible-clipping"
  | "automatic-gain-likely"
  | "all-zero-signal"
  | "device-lost"
  | "tab-or-device-suspended"
  | "transcript-missing"
  | "insufficient-speech"
  | "partial-samples";
```

`speechSegments` are timing aggregates, not audio samples. They may be stored for transparent calculation and visualization; their use is limited to timing-style feedback.

## 8. Video metric models

```ts
export type FramingCondition =
  | "workable"
  | "too-close"
  | "too-far"
  | "edge-or-partial"
  | "no-face-detected"
  | "unknown";

export type BrightnessCategory =
  | "dim"
  | "balanced"
  | "bright"
  | "possible-backlighting"
  | "uneven"
  | "unknown";

export interface CategoryDistribution<Category extends string> {
  readonly counts: Readonly<Record<Category, number>>;
  readonly dominant: Category;
}

export interface OrientationCalibration {
  readonly sampleCount: number;
  readonly baselineYawDegrees: Degrees;
  readonly baselinePitchDegrees: Degrees;
  readonly calibrationQuality: "adequate" | "unstable" | "unavailable";
}

export interface VideoThresholdSnapshot {
  readonly centringHorizontalTolerance: NormalizedRatio;
  readonly centringVerticalTolerance: NormalizedRatio;
  readonly nearCameraYawToleranceDegrees: Degrees;
  readonly nearCameraPitchToleranceDegrees: Degrees;
  readonly workableFaceAreaMinRatio: NormalizedRatio;
  readonly workableFaceAreaMaxRatio: NormalizedRatio;
  readonly dimLumaThreshold: NormalizedRatio;
  readonly brightLumaThreshold: NormalizedRatio;
}

export interface VideoMetrics {
  readonly algorithmVersion: string;
  readonly modelVersion: string;
  readonly status: "complete" | "partial" | "unavailable";
  readonly targetSampleRateHz: Hertz;
  readonly processedFrameCount: number;
  readonly droppedFrameCount: number;
  readonly invalidFrameCount: number;
  readonly faceDetectionPercentage: MetricValue<Percentage>;
  readonly singleFacePercentage: MetricValue<Percentage>;
  readonly multipleFacePercentage: MetricValue<Percentage>;
  readonly reasonableCentringPercentage: MetricValue<Percentage>;
  readonly nearCameraOrientationPercentage: MetricValue<Percentage>;
  readonly medianYawDeltaDegrees: MetricValue<Degrees>;
  readonly medianPitchDeltaDegrees: MetricValue<Degrees>;
  readonly framing: MetricValue<CategoryDistribution<FramingCondition>>;
  readonly brightness: MetricValue<CategoryDistribution<BrightnessCategory>>;
  readonly orientationCalibration?: OrientationCalibration;
  readonly thresholds: VideoThresholdSnapshot;
  readonly warnings: readonly VideoMetricWarning[];
}

export type VideoMetricWarning =
  | "model-preview"
  | "worker-unavailable"
  | "model-load-failed"
  | "low-sample-count"
  | "many-dropped-frames"
  | "orientation-unstable"
  | "orientation-unavailable"
  | "camera-auto-exposure"
  | "possible-false-face-detection"
  | "device-lost"
  | "partial-samples";

export interface VideoFrameObservation {
  readonly frameId: number;
  readonly timestampOffsetMs: Milliseconds;
  readonly faceCount: 0 | 1 | 2;
  readonly primaryFaceDetected: boolean;
  readonly centred?: boolean;
  readonly nearCameraOrientation?: boolean;
  readonly yawDeltaDegrees?: Degrees;
  readonly pitchDeltaDegrees?: Degrees;
  readonly framing: FramingCondition;
  readonly brightness: BrightnessCategory;
}
```

`VideoFrameObservation` is a worker-to-aggregator transient contract. It may be held only until aggregation/finalization and must not be written to IndexedDB. It contains no landmarks, image, pixels, face embedding, blendshape, or matrix.

## 9. Answer analysis models

```ts
export type AnalysisCategoryId =
  | "question-relevance"
  | "specificity"
  | "concrete-example"
  | "personal-contribution"
  | "result-or-outcome"
  | "measurable-evidence"
  | "star-structure"
  | "repetition"
  | "filler-language"
  | "length"
  | "speaking-pace"
  | "clarity-and-concision";

export type AnalysisRating =
  | "strong"
  | "developing"
  | "needsMoreEvidence"
  | "notAvailable"
  | "notApplicable";

export interface AnalysisCategory {
  readonly id: AnalysisCategoryId;
  readonly label: string;
  readonly rating: AnalysisRating;
  readonly summary: string;
  readonly suggestion?: string;
  readonly evidence: readonly EvidenceSpan[];
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly details: Readonly<Record<string, JsonPrimitive>>;
  readonly limitations: readonly string[];
}

export interface AnswerAnalysis {
  readonly analyzerId: string;
  readonly heuristicVersion: string;
  readonly analyzedAt: IsoDateTime;
  readonly transcriptRevisionId: TranscriptRevisionId;
  readonly transcriptDigest: Sha256Digest;
  readonly locale: string;
  readonly categories: readonly AnalysisCategory[];
  readonly detectedStrengths: readonly string[];
  readonly suggestedImprovements: readonly string[];
  readonly summary: string;
  readonly limitations: readonly string[];
}

export interface AnswerAnalysisInput {
  readonly question: InterviewQuestion;
  readonly transcriptRevision: TranscriptRevision;
  readonly locale: string;
  readonly answerDurationMs?: Milliseconds;
  readonly speakingDurationMs?: Milliseconds;
}
```

There is intentionally no overall rating or score. There is intentionally no `VideoMetrics` in `AnswerAnalysisInput`.

## 10. Recording and response models

```ts
export interface RecordingReference {
  readonly id: RecordingId;
  readonly mimeType: string;
  readonly sizeBytes: ByteCount;
  readonly durationMs: Milliseconds;
  readonly savedByUserAt: IsoDateTime;
}

export type ResponseStatus =
  | "draft"
  | "awaiting-review"
  | "reviewed"
  | "saved"
  | "skipped"
  | "interrupted";

export interface QuestionResponse extends VersionedRecord {
  readonly schemaVersion: 1;
  readonly id: QuestionResponseId;
  readonly sessionId: InterviewSessionId;
  readonly question: InterviewQuestion;
  readonly attemptNumber: number;
  readonly status: ResponseStatus;
  readonly startedAt?: IsoDateTime;
  readonly finishedAt?: IsoDateTime;
  readonly answerDurationMs?: Milliseconds;
  readonly timingMode: TimingMode;
  readonly transcript: TranscriptResult;
  readonly audioMetrics?: AudioMetrics;
  readonly videoMetrics?: VideoMetrics;
  readonly analysis?: AnswerAnalysis;
  readonly recording?: RecordingReference;
  readonly userNotes?: string;
  readonly interruptionReason?: string;
}
```

Although a response contains both content and condition results for report convenience, the analyzer and comparison services receive separately projected inputs. The `analysis` object never derives from `videoMetrics`.

## 11. Interview session model

```ts
export type InterviewSessionStatus =
  | "draft"
  | "ready"
  | "in-progress"
  | "awaiting-review"
  | "complete"
  | "ended-early"
  | "recovery-required";

export type InterviewMachineStateName =
  | "ready"
  | "preparing"
  | "answering"
  | "reviewing"
  | "betweenQuestions"
  | "complete";

export interface InterviewSession extends VersionedRecord {
  readonly schemaVersion: 1;
  readonly id: InterviewSessionId;
  readonly status: InterviewSessionStatus;
  readonly context: InterviewContext;
  readonly settingsSnapshot: InterviewSettings;
  readonly questions: readonly InterviewQuestion[];
  readonly responseIds: readonly QuestionResponseId[];
  readonly currentQuestionIndex: number;
  readonly safeMachineState: Exclude<
    InterviewMachineStateName,
    "preparing" | "answering"
  >;
  readonly selectedAttemptByQuestion: Readonly<
    Record<InterviewQuestionId, QuestionResponseId>
  >;
  readonly capabilitySnapshot?: BrowserCapabilityReport;
  readonly permissionSnapshot?: PermissionSnapshot;
  readonly extractedKeywords: readonly ExtractedKeyword[];
  readonly algorithms: AlgorithmVersions;
  readonly completedAt?: IsoDateTime;
  readonly userNotes?: string;
  readonly isDemo: boolean;
}
```

Persistence must coerce an active `preparing` or `answering` checkpoint to `ready` or `reviewing` recovery before reload. Active capture is never reconstructed.

## 12. Fairness Lab models

```ts
export type FairnessConditionPreset =
  | "near-camera"
  | "looking-at-question"
  | "side-camera"
  | "camera-below-monitor"
  | "dim-lighting"
  | "strong-backlighting"
  | "partial-framing"
  | "natural-glances"
  | "low-resolution"
  | "custom";

export interface FairnessCondition {
  readonly preset: FairnessConditionPreset;
  readonly label: string;
  readonly userNotes?: string;
  readonly source: "user-described" | "seeded-demo";
}

export interface ContentFeatureSnapshot {
  readonly transcriptRevisionId: TranscriptRevisionId;
  readonly transcriptDigest: Sha256Digest;
  readonly normalizedText: string;
  readonly wordCount: number;
  readonly relevance: AnalysisRating;
  readonly specificity: AnalysisRating;
  readonly personalContribution: AnalysisRating;
  readonly outcome: AnalysisRating;
  readonly starElementsDetected: readonly ("situation" | "task" | "action" | "result")[];
}

export interface FairnessTrial extends VersionedRecord {
  readonly schemaVersion: 1;
  readonly id: FairnessTrialId;
  readonly groupId: FairnessGroupId;
  readonly comparisonId: FairnessComparisonId;
  readonly question: InterviewQuestion;
  readonly condition: FairnessCondition;
  readonly source: "recorded-response" | "manual" | "reused-response" | "seeded-demo";
  readonly responseId?: QuestionResponseId;
  readonly content: ContentFeatureSnapshot;
  readonly videoMetrics?: VideoMetrics;
  readonly audioMetrics?: AudioMetrics;
  readonly isDemo: boolean;
}

export type TranscriptSimilarityBand =
  | "exact"
  | "substantially-unchanged"
  | "similar"
  | "different"
  | "unavailable";

export interface PairwiseTranscriptSimilarity {
  readonly leftTrialId: FairnessTrialId;
  readonly rightTrialId: FairnessTrialId;
  readonly band: TranscriptSimilarityBand;
  readonly normalizedExactMatch: boolean;
  readonly cosineUnigramSimilarity?: NormalizedRatio;
  readonly trigramJaccardSimilarity?: NormalizedRatio;
  readonly weightedSimilarity?: NormalizedRatio;
  readonly wordCountDifferencePercentage?: Percentage;
  readonly reason?: string;
}

export interface FairnessContentComparison {
  readonly pairwise: readonly PairwiseTranscriptSimilarity[];
  readonly allContentInvariant: boolean;
  readonly invariantBand?: "exact" | "substantially-unchanged";
  readonly categoryComparison: readonly {
    readonly category:
      | "word-count"
      | "question-relevance"
      | "specificity"
      | "personal-contribution"
      | "outcome"
      | "star-elements";
    readonly values: Readonly<Record<FairnessTrialId, JsonPrimitive | readonly string[]>>;
  }[];
}

export interface FairnessVideoConditionComparison {
  readonly availableTrialIds: readonly FairnessTrialId[];
  readonly unavailableTrialIds: readonly FairnessTrialId[];
  readonly rows: readonly {
    readonly metric:
      | "face-detection"
      | "centring"
      | "near-camera-orientation"
      | "framing"
      | "brightness"
      | "multiple-face";
    readonly values: Readonly<Record<FairnessTrialId, JsonValue>>;
  }[];
}

export type FairnessComparisonStatus = "current" | "stale" | "incomplete";

export interface FairnessComparison extends VersionedRecord {
  readonly schemaVersion: 1;
  readonly id: FairnessComparisonId;
  readonly groupId: FairnessGroupId;
  readonly status: FairnessComparisonStatus;
  readonly title: string;
  readonly question: InterviewQuestion;
  readonly trialIds: readonly FairnessTrialId[];
  readonly sourceTranscriptRevisions: Readonly<
    Record<FairnessTrialId, TranscriptRevisionId>
  >;
  readonly algorithmVersion: string;
  readonly content: FairnessContentComparison;
  readonly videoConditions: FairnessVideoConditionComparison;
  readonly approvedInvariantMessage?: string;
  readonly summary: string;
  readonly limitations: readonly string[];
  readonly userNotes?: string;
  readonly isDemo: boolean;
}
```

`approvedInvariantMessage` is present only when every required pair is `exact` or `substantially-unchanged`, and its only allowed value is:

> The answer content remained unchanged. Differences in video conditions should not be interpreted as differences in competence.

## 13. User settings

```ts
export type TextSizePreference = "default" | "large" | "extra-large";
export type ContrastPreference = "system" | "default" | "high";
export type MotionPreference = "system" | "reduced" | "standard";

export interface UserSettings extends VersionedRecord {
  readonly schemaVersion: 1;
  readonly id: UserSettingsId;
  readonly defaultInterviewSettings: InterviewSettings;
  readonly textSize: TextSizePreference;
  readonly contrast: ContrastPreference;
  readonly motion: MotionPreference;
  readonly hideSelfPreviewWhileAnswering: boolean;
  readonly showConditionPrompts: boolean;
  readonly announceTimerThresholds: boolean;
  readonly preferredLocale: string;
  readonly rememberSelectedDevices: boolean;
  readonly preferredCameraDeviceId?: string;
  readonly preferredMicrophoneDeviceId?: string;
  readonly persistentStorageRequested: boolean;
  readonly browserSpeechDisclosureVersion?: string;
  readonly browserSpeechDisclosureAcceptedAt?: IsoDateTime;
}
```

Default values:

```ts
export const DEFAULT_INTERVIEW_SETTINGS: InterviewSettings = {
  questionCount: 5,
  preparationTimeMs: milliseconds(60_000),
  answerTimeMs: milliseconds(120_000),
  timingMode: "flexible",
  extensionTimeMs: milliseconds(30_000),
  liveCoaching: "off",
  transcription: "manual",
  cameraRequested: false,
  microphoneRequested: false,
  recordingCaptureRequested: false,
  screenReaderTimerAnnouncements: true,
};
```

All user/config values pass through the same validated factories before a settings object is created.

## 14. Export models

```ts
export type ExportFormat = "print" | "text" | "json";

export type ExportField =
  | "session-context"
  | "reviewed-transcripts"
  | "content-coaching"
  | "timing-audio-metrics"
  | "video-conditions"
  | "notes"
  | "fairness-comparison";

export interface ExportSelection {
  readonly format: ExportFormat;
  readonly fields: readonly ExportField[];
}

export interface ExportedQuestionResponse {
  readonly question: InterviewQuestion;
  readonly attemptNumber: number;
  readonly transcript?: TranscriptRevision;
  readonly analysis?: AnswerAnalysis;
  readonly audioMetrics?: AudioMetrics;
  readonly videoMetrics?: VideoMetrics;
  readonly notes?: string;
}

export interface InterviewReportExport {
  readonly sessionId: InterviewSessionId;
  readonly context?: InterviewContext;
  readonly settings: InterviewSettings;
  readonly responses: readonly ExportedQuestionResponse[];
  readonly notes?: string;
}

export interface FairnessReportExport {
  readonly comparison: FairnessComparison;
  readonly trials: readonly FairnessTrial[];
}

export interface FairScreenExportEnvelope<
  Data extends InterviewReportExport | FairnessReportExport,
> {
  readonly format: "fairscreen-export";
  readonly exportSchemaVersion: 1;
  readonly exportedAt: IsoDateTime;
  readonly appVersion: string;
  readonly kind: Data extends InterviewReportExport
    ? "session"
    : "fairness-comparison";
  readonly includedFields: readonly ExportField[];
  readonly warning: string;
  readonly data: Data;
}
```

The exporter must build a projection from the user's selection. It must not serialize a complete repository object and then remove fields.

## 15. Provider and repository ports

```ts
export interface CancellationSignal {
  readonly aborted: boolean;
  addAbortListener(listener: () => void): () => void;
}

export interface QuestionProvider {
  readonly providerId: string;
  readonly providerVersion: string;
  generate(
    request: QuestionGenerationRequest,
    signal?: CancellationSignal,
  ): Promise<QuestionGenerationResult>;
}

export interface TranscriptionCapability {
  readonly status: CapabilityStatus;
  readonly processingMode: TranscriptionProcessingMode;
  readonly disclosureRequired: boolean;
  readonly limitations: readonly string[];
}

export interface TranscriptionStartInput {
  readonly locale: string;
  readonly disclosureAccepted: boolean;
}

export interface TranscriptionSession {
  readonly sessionId: string;
  stop(): Promise<TranscriptResult>;
  abort(): void;
  subscribe(listener: (result: TranscriptResult) => void): () => void;
}

export interface TranscriptionProvider {
  readonly kind: "browser-speech" | "manual" | "none";
  getCapability(): Promise<TranscriptionCapability>;
  start(
    input: TranscriptionStartInput,
    signal?: CancellationSignal,
  ): Promise<TranscriptionSession>;
}

export interface AnswerAnalyzer {
  readonly analyzerId: string;
  readonly heuristicVersion: string;
  analyze(input: AnswerAnalysisInput): AnswerAnalysis;
}

export interface FairnessComparator {
  readonly algorithmVersion: string;
  compare(trials: readonly FairnessTrial[]): FairnessComparison;
}

export interface PageRequest {
  readonly cursor?: string;
  readonly pageSize: number;
}

export interface PageResult<Value> {
  readonly values: readonly Value[];
  readonly nextCursor?: string;
}

export interface SessionSearchQuery {
  readonly text?: string;
  readonly statuses?: readonly InterviewSessionStatus[];
  readonly categories?: readonly InterviewCategory[];
  readonly createdAfter?: IsoDateTime;
  readonly createdBefore?: IsoDateTime;
  readonly includesSavedRecording?: boolean;
  readonly isDemo?: boolean;
  readonly sort:
    | "updated-desc"
    | "updated-asc"
    | "created-desc"
    | "job-title-asc";
}

export interface SessionRepository {
  open(): Promise<void>;
  getSession(id: InterviewSessionId): Promise<InterviewSession | null>;
  listSessions(
    query: SessionSearchQuery,
    page: PageRequest,
  ): Promise<PageResult<InterviewSession>>;
  saveSession(session: InterviewSession): Promise<void>;
  getResponse(id: QuestionResponseId): Promise<QuestionResponse | null>;
  listResponses(sessionId: InterviewSessionId): Promise<readonly QuestionResponse[]>;
  saveResponse(response: QuestionResponse): Promise<void>;
  deleteResponse(id: QuestionResponseId): Promise<void>;
  deleteSession(id: InterviewSessionId): Promise<void>;
  getFairnessComparison(
    id: FairnessComparisonId,
  ): Promise<FairnessComparison | null>;
  saveFairnessComparison(
    comparison: FairnessComparison,
    trials: readonly FairnessTrial[],
  ): Promise<void>;
  deleteFairnessComparison(id: FairnessComparisonId): Promise<void>;
  getSettings(): Promise<UserSettings>;
  saveSettings(settings: UserSettings): Promise<void>;
  deleteAllData(): Promise<void>;
}
```

Recording Blob methods belong to an infrastructure-level `RecordingRepository` because Blob is a browser type. Domain operations pass validated `RecordingReference` metadata plus an opaque infrastructure handle, never the binary object through content services.

## 16. Error models

```ts
export type AppErrorCode =
  | "MEDIA_PERMISSION_DENIED"
  | "MEDIA_PERMISSION_PENDING"
  | "MEDIA_DEVICE_NOT_FOUND"
  | "MEDIA_DEVICE_UNREADABLE"
  | "MEDIA_CONSTRAINTS_UNSATISFIED"
  | "INSECURE_CONTEXT"
  | "AUDIO_CONTEXT_FAILED"
  | "RECORDER_UNSUPPORTED"
  | "RECORDER_FAILED"
  | "VIDEO_MODEL_FAILED"
  | "VIDEO_WORKER_FAILED"
  | "TRANSCRIPTION_UNSUPPORTED"
  | "TRANSCRIPTION_FAILED"
  | "STORAGE_OPEN_FAILED"
  | "STORAGE_QUOTA_EXCEEDED"
  | "STORAGE_RECORD_CORRUPT"
  | "EXPORT_FAILED"
  | "UNEXPECTED_ERROR";

export type RecoveryAction =
  | "retry"
  | "continue-without-camera"
  | "continue-without-microphone"
  | "continue-without-recording"
  | "use-manual-transcript"
  | "use-timing-only"
  | "use-ephemeral-session"
  | "export"
  | "delete-selected-data"
  | "go-home"
  | "open-saved";

export interface PrivacySafeDiagnostic {
  readonly code: string;
  readonly operation: string;
  readonly capability?: string;
  readonly state?: string;
  readonly occurredAt: IsoDateTime;
}

export interface AppError {
  readonly code: AppErrorCode;
  readonly category:
    | "capability"
    | "permission"
    | "device"
    | "analysis"
    | "storage"
    | "export"
    | "unexpected";
  readonly severity: "info" | "warning" | "recoverable" | "fatal";
  readonly userMessageKey: string;
  readonly recoverable: boolean;
  readonly actions: readonly RecoveryAction[];
  readonly diagnostic: PrivacySafeDiagnostic;
}
```

## 17. Required runtime invariants

These invariants require unit and integration tests:

1. A reviewed `AnswerAnalysis.transcriptRevisionId` equals the response's active reviewed revision.
2. `AnswerAnalysisInput` has no video field at compile time and runtime.
3. `VideoMetrics` has no overall score or trait field.
4. A saved recording always has `savedByUserAt`.
5. `recordingCaptureRequested: true` alone never creates `RecordingReference`.
6. A complete session contains no active `preparing` or `answering` state.
7. Every session question ID is unique and order is contiguous from 0.
8. Every response question snapshot matches one session question ID.
9. A selected report attempt belongs to the same session and question.
10. Percentages are finite and within 0–100.
11. Durations and counts are finite non-negative integers.
12. Available/partial WPM requires a reviewed transcript, ≥10 words, and ≥5 seconds of detected speech.
13. Near-camera orientation can be available only when calibration and matrix convention validation succeeded.
14. `approvedInvariantMessage` exists only for exact/substantially unchanged comparisons and uses the exact approved text.
15. Demo IDs and records cannot collide with user-created IDs.
16. Export projections contain no recording reference when the format could imply embedded media.
17. Repository payload guards reject keys or nested values representing raw landmarks, frames, pixels, PCM, matrices, or embeddings.

## 18. Persistence serialization note

Branded primitives erase to normal strings/numbers at runtime. The repository must:

- validate plain serialized values;
- construct brands through factories;
- deep-freeze domain records in development where practical;
- clone at adapter boundaries;
- preserve unknown future export fields only in read-only inspection, not domain objects;
- never use a type assertion as a substitute for migration/validation.

Decision D-013 selects Zod for persistence, export/import, worker-message, and external-configuration boundaries. Keep the stable domain types explicit; map validated boundary values into them through factories and invariants rather than treating schema inference or a type assertion as domain validation.
