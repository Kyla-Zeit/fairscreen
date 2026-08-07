import type {
  AlgorithmVersions,
  ByteCount,
  DecibelsFullScale,
  Degrees,
  EvidenceSpan,
  FairnessComparisonId,
  FairnessGroupId,
  FairnessTrialId,
  Hertz,
  InterviewQuestionId,
  InterviewSessionId,
  IsoDateTime,
  JsonPrimitive,
  JsonValue,
  MetricValue,
  Milliseconds,
  NormalizedRatio,
  Percentage,
  QuestionResponseId,
  QuestionTemplateId,
  RecordingId,
  Sha256Digest,
  TranscriptRevisionId,
  UserSettingsId,
  VersionedRecord,
  WordsPerMinute,
} from "./common";

export type InterviewCategory =
  | "general-behavioural"
  | "software-technical"
  | "customer-service"
  | "leadership"
  | "investigative"
  | "custom-mixed";

export type InterviewDifficulty = "foundational" | "standard" | "advanced";

export type TimingMode = "flexible" | "strictPractice" | "untimed";
export type TranscriptionPreference =
  "ask-when-supported" | "manual" | "timing-only";
export type LiveCoachingPreference =
  "off" | "delivery-timing" | "answer-structure" | "both";

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
  readonly companyWebsiteUrl?: string;
  readonly jobPostingUrl?: string;
  readonly jobPostingImport?: unknown;
  readonly jobDescription?: string;
  readonly resumeText?: string;
  readonly resumeMetadata?: unknown;
  readonly companyResearch?: unknown;
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

export type QuestionSource =
  "built-in" | "adapted-template" | "custom" | "fallback";

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
  "supported" | "limited" | "unsupported" | "blocked" | "unknown";

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

export type TranscriptSource =
  "browser-speech" | "manual" | "edited-browser-speech" | "none";
export type TranscriptionProcessingMode = "device" | "remote" | "unknown";

export interface RecognitionSegment {
  readonly text: string;
  readonly isFinal: boolean;
  readonly startOffsetMs?: Milliseconds;
  readonly endOffsetMs?: Milliseconds;
}

/** Interview/review state only; never a persistence or export payload. */
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

export interface TranscriptResult {
  readonly status:
    "complete" | "partial" | "manual" | "timing-only" | "unavailable";
  readonly providerId: string;
  readonly processingMode: TranscriptionProcessingMode;
  readonly disclosureAcceptedAt?: IsoDateTime;
  readonly activeRevision?: TranscriptRevision;
  readonly revisions: readonly TranscriptRevision[];
  readonly errors: readonly TranscriptionError[];
  readonly limitations: readonly string[];
}

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

/** Worker-to-aggregator only; never a persistence payload. */
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
  readonly displayName?: string;
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
  readonly starElementsDetected: readonly (
    "situation" | "task" | "action" | "result"
  )[];
}

export interface FairnessTrial extends VersionedRecord {
  readonly schemaVersion: 1;
  readonly id: FairnessTrialId;
  readonly groupId: FairnessGroupId;
  readonly comparisonId: FairnessComparisonId;
  readonly question: InterviewQuestion;
  readonly condition: FairnessCondition;
  readonly source:
    "recorded-response" | "manual" | "reused-response" | "seeded-demo";
  readonly responseId?: QuestionResponseId;
  readonly content: ContentFeatureSnapshot;
  readonly videoMetrics?: VideoMetrics;
  readonly audioMetrics?: AudioMetrics;
  readonly isDemo: boolean;
}

export type TranscriptSimilarityBand =
  "exact" | "substantially-unchanged" | "similar" | "different" | "unavailable";

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
    readonly values: Readonly<
      Record<FairnessTrialId, JsonPrimitive | readonly string[]>
    >;
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
