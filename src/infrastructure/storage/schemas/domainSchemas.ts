import { z } from "zod";
import {
  byteCount,
  decibelsFullScale,
  degrees,
  fairnessComparisonId,
  fairnessGroupId,
  fairnessTrialId,
  hertz,
  interviewQuestionId,
  interviewSessionId,
  isoDateTime,
  milliseconds,
  normalizedRatio,
  percentage,
  questionResponseId,
  questionTemplateId,
  recordingId,
  sha256Digest,
  transcriptRevisionId,
  userSettingsId,
  validatedLocale,
  wordsPerMinute,
} from "../../../domain/factories";
import type {
  FairnessComparison,
  FairnessTrial,
  InterviewSession,
  QuestionResponse,
  UserSettings,
} from "../../../domain/models";

const safeIntegerSchema = z.number().int();
const nonNegativeIntegerSchema = safeIntegerSchema.nonnegative();
const nonEmptyStringSchema = z.string().trim().min(1);
const stringListSchema = z.array(z.string());
const isoDateTimeSchema = z.string().transform(isoDateTime);
const sessionIdSchema = z.string().transform(interviewSessionId);
const questionIdSchema = z.string().transform(interviewQuestionId);
const responseIdSchema = z.string().transform(questionResponseId);
const transcriptIdSchema = z.string().transform(transcriptRevisionId);
const recordingIdSchema = z.string().transform(recordingId);
const trialIdSchema = z.string().transform(fairnessTrialId);
const comparisonIdSchema = z.string().transform(fairnessComparisonId);
const groupIdSchema = z.string().transform(fairnessGroupId);
const settingsIdSchema = z.string().transform(userSettingsId);
const digestSchema = z.string().transform(sha256Digest);
const millisecondsSchema = nonNegativeIntegerSchema.transform(milliseconds);
const hertzSchema = z.number().transform(hertz);
const dbfsSchema = z.number().transform(decibelsFullScale);
const wpmSchema = z.number().transform(wordsPerMinute);
const percentageSchema = z.number().transform(percentage);
const ratioSchema = z.number().transform(normalizedRatio);
const degreesSchema = z.number().transform(degrees);
const byteCountSchema = nonNegativeIntegerSchema.transform(byteCount);
const localeSchema = z.string().transform(validatedLocale);

const interviewCategorySchema = z.enum([
  "general-behavioural",
  "software-technical",
  "customer-service",
  "leadership",
  "investigative",
  "custom-mixed",
]);
const interviewDifficultySchema = z.enum([
  "foundational",
  "standard",
  "advanced",
]);
const timingModeSchema = z.enum(["flexible", "strictPractice", "untimed"]);
const analysisRatingSchema = z.enum([
  "strong",
  "developing",
  "needsMoreEvidence",
  "notAvailable",
  "notApplicable",
]);
const availabilityReasonSchema = z.enum([
  "not-requested",
  "permission-denied",
  "permission-blocked",
  "unsupported",
  "initialization-failed",
  "device-lost",
  "insufficient-samples",
  "invalid-signal",
  "missing-transcript",
  "user-declined",
  "storage-failed",
  "interrupted",
  "unknown",
]);

const jsonPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const jsonValueSchema: z.ZodType<
  | string
  | number
  | boolean
  | null
  | readonly unknown[]
  | Readonly<Record<string, unknown>>
> = z.lazy(() =>
  z.union([
    jsonPrimitiveSchema,
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const algorithmVersionsSchema = z
  .object({
    questionProvider: nonEmptyStringSchema,
    keywordExtractor: nonEmptyStringSchema,
    audioMetrics: nonEmptyStringSchema,
    videoMetrics: nonEmptyStringSchema,
    answerHeuristics: nonEmptyStringSchema,
    fairnessSimilarity: nonEmptyStringSchema,
  })
  .strict();

export const interviewSettingsSchema = z
  .object({
    questionCount: safeIntegerSchema.min(1).max(10),
    preparationTimeMs: millisecondsSchema.refine((value) => value <= 600_000),
    answerTimeMs: millisecondsSchema.refine(
      (value) => value >= 30_000 && value <= 1_200_000,
    ),
    timingMode: timingModeSchema,
    extensionTimeMs: millisecondsSchema.refine(
      (value) => value >= 10_000 && value <= 600_000,
    ),
    liveCoaching: z.enum([
      "off",
      "delivery-timing",
      "answer-structure",
      "both",
    ]),
    transcription: z.enum(["ask-when-supported", "manual", "timing-only"]),
    cameraRequested: z.boolean(),
    microphoneRequested: z.boolean(),
    recordingCaptureRequested: z.boolean(),
    screenReaderTimerAnnouncements: z.boolean(),
  })
  .strict();

const codePointLimitedString = (maximum: number) =>
  z
    .string()
    .trim()
    .refine((value) => Array.from(value).length <= maximum, {
      message: "Text exceeds its supported length.",
    });

export const interviewContextSchema = z
  .object({
    jobTitle: codePointLimitedString(120),
    company: codePointLimitedString(120).optional(),
    companyWebsiteUrl: z.string().url().max(2_000).optional(),
    jobPostingUrl: z.string().url().max(2_000).optional(),
    jobPostingImport: z.unknown().optional(),
    jobDescription: codePointLimitedString(20_000).optional(),
    resumeText: codePointLimitedString(20_000).optional(),
    resumeMetadata: z.unknown().optional(),
    companyResearch: z.unknown().optional(),
    category: interviewCategorySchema,
    difficulty: interviewDifficultySchema,
    locale: localeSchema,
  })
  .strict();

const extractedKeywordSchema = z
  .object({
    normalized: nonEmptyStringSchema,
    display: nonEmptyStringSchema,
    source: z.enum(["job-title", "job-description", "resume"]),
    weight: z.number().nonnegative(),
    kind: z.enum(["role", "skill", "technology", "domain", "responsibility"]),
  })
  .strict();

const questionTagSchema = z.enum([
  "introduction",
  "motivation",
  "problem-solving",
  "adaptability",
  "learning",
  "conflict",
  "prioritization",
  "ownership",
  "technical-depth",
  "debugging",
  "api",
  "data",
  "accessibility",
  "testing",
  "delivery",
  "security-privacy",
  "customer",
  "communication",
  "leadership",
  "investigation",
  "evidence",
  "documentation",
  "confidentiality",
  "trade-off",
  "reflection",
]);

export const interviewQuestionSchema = z
  .object({
    id: questionIdSchema,
    source: z.enum(["built-in", "adapted-template", "custom", "fallback"]),
    templateId: z.string().transform(questionTemplateId).optional(),
    text: nonEmptyStringSchema,
    normalizedText: nonEmptyStringSchema,
    category: interviewCategorySchema,
    difficulty: interviewDifficultySchema,
    tags: z.array(questionTagSchema),
    renderedKeywords: z.array(extractedKeywordSchema),
    order: nonNegativeIntegerSchema,
    providerId: nonEmptyStringSchema,
    providerVersion: nonEmptyStringSchema,
  })
  .strict();

const capabilityDetailSchema = z
  .object({
    status: z.enum([
      "supported",
      "limited",
      "unsupported",
      "blocked",
      "unknown",
    ]),
    label: nonEmptyStringSchema,
    reason: z.string().optional(),
    fallback: z.string().optional(),
  })
  .strict();

const browserCapabilityReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    capturedAt: isoDateTimeSchema,
    secureContext: capabilityDetailSchema,
    mediaDevices: capabilityDetailSchema,
    deviceEnumeration: capabilityDetailSchema,
    webAudio: capabilityDetailSchema,
    mediaRecorder: capabilityDetailSchema,
    recorderMimeTypes: z.array(
      z
        .object({
          mimeType: z.string(),
          reportedSupported: z.boolean(),
          trialResult: z.enum(["not-run", "succeeded", "failed"]),
        })
        .strict(),
    ),
    worker: capabilityDetailSchema,
    webAssembly: capabilityDetailSchema,
    mediaPipeFaceLandmarker: capabilityDetailSchema,
    speechRecognition: z
      .object({
        status: z.enum([
          "supported",
          "limited",
          "unsupported",
          "blocked",
          "unknown",
        ]),
        constructorKind: z.enum(["standard", "prefixed", "none"]),
        processingMode: z.enum(["device", "remote", "unknown"]),
        localProcessingControl: z.enum(["available", "unavailable", "unknown"]),
        disclosureRequired: z.boolean(),
      })
      .strict(),
    storage: z
      .object({
        indexedDb: capabilityDetailSchema,
        estimate: capabilityDetailSchema,
        persistenceRequest: capabilityDetailSchema,
        estimatedUsageBytes: byteCountSchema.optional(),
        estimatedQuotaBytes: byteCountSchema.optional(),
        persistent: z.boolean().optional(),
      })
      .strict(),
    print: capabilityDetailSchema,
    blobDownload: capabilityDetailSchema,
    limitations: stringListSchema,
  })
  .strict();

const permissionSnapshotSchema = z
  .object({
    camera: z.enum([
      "not-requested",
      "prompt",
      "granted",
      "denied",
      "blocked",
      "unavailable",
      "unknown",
    ]),
    microphone: z.enum([
      "not-requested",
      "prompt",
      "granted",
      "denied",
      "blocked",
      "unavailable",
      "unknown",
    ]),
    capturedAt: isoDateTimeSchema,
    source: z.enum(["media-request", "permissions-api", "capability-scan"]),
  })
  .strict();

export const transcriptRevisionSchema = z
  .object({
    id: transcriptIdSchema,
    createdAt: isoDateTimeSchema,
    text: codePointLimitedString(50_000),
    source: z.enum([
      "browser-speech",
      "manual",
      "edited-browser-speech",
      "none",
    ]),
    reviewedByUser: z.literal(true),
    locale: localeSchema,
    wordCount: nonNegativeIntegerSchema,
    normalizedDigest: digestSchema,
  })
  .strict();

const transcriptResultSchema = z
  .object({
    status: z.enum([
      "complete",
      "partial",
      "manual",
      "timing-only",
      "unavailable",
    ]),
    providerId: nonEmptyStringSchema,
    processingMode: z.enum(["device", "remote", "unknown"]),
    disclosureAcceptedAt: isoDateTimeSchema.optional(),
    activeRevision: transcriptRevisionSchema.optional(),
    revisions: z.array(transcriptRevisionSchema),
    errors: z.array(
      z
        .object({
          code: z.enum([
            "unsupported",
            "permission-denied",
            "no-match",
            "network",
            "audio-capture",
            "service-not-allowed",
            "aborted",
            "ended",
            "unknown",
          ]),
          recoverable: z.boolean(),
          safeMessage: z.string().max(240),
        })
        .strict(),
    ),
    limitations: stringListSchema,
  })
  .strict();

function metricValueSchema<Value>(valueSchema: z.ZodType<Value>) {
  return z.discriminatedUnion("status", [
    z
      .object({
        status: z.literal("available"),
        value: valueSchema,
        calculationQuality: z.enum(["adequate", "limited"]),
        limitations: stringListSchema,
      })
      .strict(),
    z
      .object({
        status: z.literal("partial"),
        value: valueSchema,
        calculationQuality: z.literal("limited"),
        limitations: stringListSchema,
        reason: availabilityReasonSchema,
      })
      .strict(),
    z
      .object({
        status: z.literal("unavailable"),
        reason: availabilityReasonSchema,
        limitations: stringListSchema,
      })
      .strict(),
  ]);
}

export const audioMetricsSchema = z
  .object({
    algorithmVersion: nonEmptyStringSchema,
    status: z.enum(["complete", "partial", "unavailable"]),
    sampleRateHz: hertzSchema,
    sampleCount: nonNegativeIntegerSchema,
    invalidSampleCount: nonNegativeIntegerSchema,
    calibration: z
      .object({
        sampleCount: nonNegativeIntegerSchema,
        noiseFloorDbfs: dbfsSchema,
        speechThresholdDbfs: dbfsSchema,
        attackMs: millisecondsSchema,
        releaseMs: millisecondsSchema,
        calibrationQuality: z.enum(["adequate", "noisy", "invalid"]),
      })
      .strict()
      .optional(),
    answerDurationMs: metricValueSchema(millisecondsSchema),
    delayBeforeSpeechMs: metricValueSchema(millisecondsSchema),
    speakingDurationMs: metricValueSchema(millisecondsSchema),
    silenceDurationMs: metricValueSchema(millisecondsSchema),
    longestInternalSilenceMs: metricValueSchema(millisecondsSchema),
    averageMicrophoneLevelDbfs: metricValueSchema(dbfsSchema),
    peakMicrophoneLevelDbfs: metricValueSchema(dbfsSchema),
    approximateWordsPerMinute: metricValueSchema(wpmSchema),
    speechSegments: z.array(
      z
        .object({
          startOffsetMs: millisecondsSchema,
          endOffsetMs: millisecondsSchema,
        })
        .strict()
        .refine((value) => value.endOffsetMs >= value.startOffsetMs),
    ),
    warnings: z.array(
      z.enum([
        "high-noise-floor",
        "possible-clipping",
        "automatic-gain-likely",
        "all-zero-signal",
        "device-lost",
        "tab-or-device-suspended",
        "transcript-missing",
        "insufficient-speech",
        "partial-samples",
      ]),
    ),
  })
  .strict();

const framingConditionSchema = z.enum([
  "workable",
  "too-close",
  "too-far",
  "edge-or-partial",
  "no-face-detected",
  "unknown",
]);
const brightnessCategorySchema = z.enum([
  "dim",
  "balanced",
  "bright",
  "possible-backlighting",
  "uneven",
  "unknown",
]);
const distributionSchema = <Category extends string>(
  categorySchema: z.ZodType<Category>,
) =>
  z
    .object({
      counts: z.record(categorySchema, nonNegativeIntegerSchema),
      dominant: categorySchema,
    })
    .strict();

export const videoMetricsSchema = z
  .object({
    algorithmVersion: nonEmptyStringSchema,
    modelVersion: nonEmptyStringSchema,
    status: z.enum(["complete", "partial", "unavailable"]),
    targetSampleRateHz: hertzSchema,
    processedFrameCount: nonNegativeIntegerSchema,
    droppedFrameCount: nonNegativeIntegerSchema,
    invalidFrameCount: nonNegativeIntegerSchema,
    faceDetectionPercentage: metricValueSchema(percentageSchema),
    singleFacePercentage: metricValueSchema(percentageSchema),
    multipleFacePercentage: metricValueSchema(percentageSchema),
    reasonableCentringPercentage: metricValueSchema(percentageSchema),
    nearCameraOrientationPercentage: metricValueSchema(percentageSchema),
    medianYawDeltaDegrees: metricValueSchema(degreesSchema),
    medianPitchDeltaDegrees: metricValueSchema(degreesSchema),
    framing: metricValueSchema(distributionSchema(framingConditionSchema)),
    brightness: metricValueSchema(distributionSchema(brightnessCategorySchema)),
    orientationCalibration: z
      .object({
        sampleCount: nonNegativeIntegerSchema,
        baselineYawDegrees: degreesSchema,
        baselinePitchDegrees: degreesSchema,
        calibrationQuality: z.enum(["adequate", "unstable", "unavailable"]),
      })
      .strict()
      .optional(),
    thresholds: z
      .object({
        centringHorizontalTolerance: ratioSchema,
        centringVerticalTolerance: ratioSchema,
        nearCameraYawToleranceDegrees: degreesSchema,
        nearCameraPitchToleranceDegrees: degreesSchema,
        workableFaceAreaMinRatio: ratioSchema,
        workableFaceAreaMaxRatio: ratioSchema,
        dimLumaThreshold: ratioSchema,
        brightLumaThreshold: ratioSchema,
      })
      .strict(),
    warnings: z.array(
      z.enum([
        "model-preview",
        "worker-unavailable",
        "model-load-failed",
        "low-sample-count",
        "many-dropped-frames",
        "orientation-unstable",
        "orientation-unavailable",
        "camera-auto-exposure",
        "possible-false-face-detection",
        "device-lost",
        "partial-samples",
      ]),
    ),
  })
  .strict();

const evidenceSpanSchema = z
  .object({
    start: nonNegativeIntegerSchema,
    end: nonNegativeIntegerSchema,
    text: z.string(),
    evidenceType: z.enum([
      "keyword",
      "example-cue",
      "action-cue",
      "outcome-cue",
      "measurement",
      "repetition",
      "filler",
      "structure-cue",
    ]),
  })
  .strict()
  .refine((value) => value.end >= value.start);

const analysisCategorySchema = z
  .object({
    id: z.enum([
      "question-relevance",
      "specificity",
      "concrete-example",
      "personal-contribution",
      "result-or-outcome",
      "measurable-evidence",
      "star-structure",
      "repetition",
      "filler-language",
      "length",
      "speaking-pace",
      "clarity-and-concision",
    ]),
    label: nonEmptyStringSchema,
    rating: analysisRatingSchema,
    summary: nonEmptyStringSchema,
    suggestion: z.string().optional(),
    evidence: z.array(evidenceSpanSchema),
    ruleId: nonEmptyStringSchema,
    ruleVersion: nonEmptyStringSchema,
    details: z.record(z.string(), jsonPrimitiveSchema),
    limitations: stringListSchema,
  })
  .strict();

export const answerAnalysisSchema = z
  .object({
    analyzerId: nonEmptyStringSchema,
    heuristicVersion: nonEmptyStringSchema,
    analyzedAt: isoDateTimeSchema,
    transcriptRevisionId: transcriptIdSchema,
    transcriptDigest: digestSchema,
    locale: localeSchema,
    categories: z.array(analysisCategorySchema),
    detectedStrengths: stringListSchema,
    suggestedImprovements: stringListSchema,
    summary: z.string(),
    limitations: stringListSchema,
  })
  .strict();

const recordingReferenceSchema = z
  .object({
    id: recordingIdSchema,
    mimeType: nonEmptyStringSchema,
    sizeBytes: byteCountSchema,
    durationMs: millisecondsSchema,
    savedByUserAt: isoDateTimeSchema,
  })
  .strict();

export const questionResponseSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: responseIdSchema,
    sessionId: sessionIdSchema,
    question: interviewQuestionSchema,
    attemptNumber: safeIntegerSchema.min(1),
    status: z.enum([
      "draft",
      "awaiting-review",
      "reviewed",
      "saved",
      "skipped",
      "interrupted",
    ]),
    startedAt: isoDateTimeSchema.optional(),
    finishedAt: isoDateTimeSchema.optional(),
    answerDurationMs: millisecondsSchema.optional(),
    timingMode: timingModeSchema,
    transcript: transcriptResultSchema,
    audioMetrics: audioMetricsSchema.optional(),
    videoMetrics: videoMetricsSchema.optional(),
    analysis: answerAnalysisSchema.optional(),
    recording: recordingReferenceSchema.optional(),
    userNotes: codePointLimitedString(10_000).optional(),
    interruptionReason: z.string().max(240).optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((response, context) => {
    const activeRevision = response.transcript.activeRevision;
    if (
      response.analysis &&
      (response.analysis.transcriptRevisionId !== activeRevision?.id ||
        response.analysis.transcriptDigest !== activeRevision.normalizedDigest)
    ) {
      context.addIssue({
        code: "custom",
        message: "Analysis does not match the active reviewed revision.",
        path: ["analysis"],
      });
    }
  });

export const interviewSessionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: sessionIdSchema,
    status: z.enum([
      "draft",
      "ready",
      "in-progress",
      "awaiting-review",
      "complete",
      "ended-early",
      "recovery-required",
    ]),
    displayName: codePointLimitedString(160).optional(),
    context: interviewContextSchema,
    settingsSnapshot: interviewSettingsSchema,
    questions: z.array(interviewQuestionSchema),
    responseIds: z.array(responseIdSchema),
    currentQuestionIndex: nonNegativeIntegerSchema,
    safeMachineState: z.enum([
      "ready",
      "reviewing",
      "betweenQuestions",
      "complete",
    ]),
    selectedAttemptByQuestion: z.record(questionIdSchema, responseIdSchema),
    capabilitySnapshot: browserCapabilityReportSchema.optional(),
    permissionSnapshot: permissionSnapshotSchema.optional(),
    extractedKeywords: z.array(extractedKeywordSchema),
    algorithms: algorithmVersionsSchema,
    completedAt: isoDateTimeSchema.optional(),
    userNotes: codePointLimitedString(10_000).optional(),
    isDemo: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((session, context) => {
    const ids = new Set<string>();
    for (const [index, question] of session.questions.entries()) {
      if (question.order !== index || ids.has(question.id)) {
        context.addIssue({
          code: "custom",
          message: "Question order or identity is invalid.",
          path: ["questions", index],
        });
      }
      ids.add(question.id);
    }
    if (session.currentQuestionIndex > session.questions.length) {
      context.addIssue({
        code: "custom",
        message: "Current question index is invalid.",
        path: ["currentQuestionIndex"],
      });
    }
  });

const fairnessContentSnapshotSchema = z
  .object({
    transcriptRevisionId: transcriptIdSchema,
    transcriptDigest: digestSchema,
    normalizedText: z.string(),
    wordCount: nonNegativeIntegerSchema,
    relevance: analysisRatingSchema,
    specificity: analysisRatingSchema,
    personalContribution: analysisRatingSchema,
    outcome: analysisRatingSchema,
    starElementsDetected: z.array(
      z.enum(["situation", "task", "action", "result"]),
    ),
  })
  .strict();

export const fairnessTrialSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: trialIdSchema,
    groupId: groupIdSchema,
    comparisonId: comparisonIdSchema,
    question: interviewQuestionSchema,
    condition: z
      .object({
        preset: z.enum([
          "near-camera",
          "looking-at-question",
          "side-camera",
          "camera-below-monitor",
          "dim-lighting",
          "strong-backlighting",
          "partial-framing",
          "natural-glances",
          "low-resolution",
          "custom",
        ]),
        label: nonEmptyStringSchema,
        userNotes: codePointLimitedString(2_000).optional(),
        source: z.enum(["user-described", "seeded-demo"]),
      })
      .strict(),
    source: z.enum([
      "recorded-response",
      "manual",
      "reused-response",
      "seeded-demo",
    ]),
    responseId: responseIdSchema.optional(),
    content: fairnessContentSnapshotSchema,
    videoMetrics: videoMetricsSchema.optional(),
    audioMetrics: audioMetricsSchema.optional(),
    isDemo: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

const pairwiseSimilaritySchema = z
  .object({
    leftTrialId: trialIdSchema,
    rightTrialId: trialIdSchema,
    band: z.enum([
      "exact",
      "substantially-unchanged",
      "similar",
      "different",
      "unavailable",
    ]),
    normalizedExactMatch: z.boolean(),
    cosineUnigramSimilarity: ratioSchema.optional(),
    trigramJaccardSimilarity: ratioSchema.optional(),
    weightedSimilarity: ratioSchema.optional(),
    wordCountDifferencePercentage: percentageSchema.optional(),
    reason: z.string().optional(),
  })
  .strict();

const fairnessContentComparisonSchema = z
  .object({
    pairwise: z.array(pairwiseSimilaritySchema),
    allContentInvariant: z.boolean(),
    invariantBand: z.enum(["exact", "substantially-unchanged"]).optional(),
    categoryComparison: z.array(
      z
        .object({
          category: z.enum([
            "word-count",
            "question-relevance",
            "specificity",
            "personal-contribution",
            "outcome",
            "star-elements",
          ]),
          values: z.record(
            trialIdSchema,
            z.union([jsonPrimitiveSchema, z.array(z.string())]),
          ),
        })
        .strict(),
    ),
  })
  .strict();

const fairnessVideoComparisonSchema = z
  .object({
    availableTrialIds: z.array(trialIdSchema),
    unavailableTrialIds: z.array(trialIdSchema),
    rows: z.array(
      z
        .object({
          metric: z.enum([
            "face-detection",
            "centring",
            "near-camera-orientation",
            "framing",
            "brightness",
            "multiple-face",
          ]),
          values: z.record(trialIdSchema, jsonValueSchema),
        })
        .strict(),
    ),
  })
  .strict();

const approvedInvariantMessage =
  "The answer content remained unchanged. Differences in video conditions should not be interpreted as differences in competence.";

export const fairnessComparisonSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: comparisonIdSchema,
    groupId: groupIdSchema,
    status: z.enum(["current", "stale", "incomplete"]),
    title: nonEmptyStringSchema,
    question: interviewQuestionSchema,
    trialIds: z.array(trialIdSchema),
    sourceTranscriptRevisions: z.record(trialIdSchema, transcriptIdSchema),
    algorithmVersion: nonEmptyStringSchema,
    content: fairnessContentComparisonSchema,
    videoConditions: fairnessVideoComparisonSchema,
    approvedInvariantMessage: z.literal(approvedInvariantMessage).optional(),
    summary: z.string(),
    limitations: stringListSchema,
    userNotes: codePointLimitedString(10_000).optional(),
    isDemo: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((comparison, context) => {
    if (
      comparison.approvedInvariantMessage &&
      (!comparison.content.allContentInvariant ||
        !comparison.content.invariantBand)
    ) {
      context.addIssue({
        code: "custom",
        message: "Invariant message requires qualifying pairwise content.",
        path: ["approvedInvariantMessage"],
      });
    }
  });

export const userSettingsSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: settingsIdSchema,
    defaultInterviewSettings: interviewSettingsSchema,
    textSize: z.enum(["default", "large", "extra-large"]),
    contrast: z.enum(["system", "default", "high"]),
    motion: z.enum(["system", "reduced", "standard"]),
    hideSelfPreviewWhileAnswering: z.boolean(),
    showConditionPrompts: z.boolean(),
    announceTimerThresholds: z.boolean(),
    preferredLocale: localeSchema,
    rememberSelectedDevices: z.boolean(),
    preferredCameraDeviceId: z.string().max(512).optional(),
    preferredMicrophoneDeviceId: z.string().max(512).optional(),
    persistentStorageRequested: z.boolean(),
    browserSpeechDisclosureVersion: z.string().max(64).optional(),
    browserSpeechDisclosureAcceptedAt: isoDateTimeSchema.optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((settings, context) => {
    if (
      !settings.rememberSelectedDevices &&
      (settings.preferredCameraDeviceId || settings.preferredMicrophoneDeviceId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Device identifiers require an explicit remember choice.",
        path: ["rememberSelectedDevices"],
      });
    }
  });

export const storedSessionSchema = z
  .object({
    id: sessionIdSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    status: z.enum([
      "draft",
      "ready",
      "in-progress",
      "awaiting-review",
      "complete",
      "ended-early",
      "recovery-required",
    ]),
    category: interviewCategorySchema,
    jobTitleNormalized: z.string(),
    record: interviewSessionSchema,
  })
  .strict();

export const metadataRecordSchema = z
  .object({
    key: z.string().min(1),
    kind: z.enum(["schema", "seed", "quarantine"]),
    schemaVersion: nonNegativeIntegerSchema,
    updatedAt: isoDateTimeSchema,
    value: jsonValueSchema,
  })
  .strict();

export function parseInterviewSession(input: unknown): InterviewSession {
  return canonicalFromBoundary<InterviewSession>(
    interviewSessionSchema.parse(input),
  );
}

export function parseQuestionResponse(input: unknown): QuestionResponse {
  return canonicalFromBoundary<QuestionResponse>(
    questionResponseSchema.parse(input),
  );
}

export function parseFairnessTrial(input: unknown): FairnessTrial {
  return canonicalFromBoundary<FairnessTrial>(fairnessTrialSchema.parse(input));
}

export function parseFairnessComparison(input: unknown): FairnessComparison {
  return canonicalFromBoundary<FairnessComparison>(
    fairnessComparisonSchema.parse(input),
  );
}

export function parseUserSettings(input: unknown): UserSettings {
  return canonicalFromBoundary<UserSettings>(userSettingsSchema.parse(input));
}

/**
 * Zod represents optional output fields as `T | undefined`. FairScreen's
 * canonical models require absent optionals to be omitted, so the validated
 * boundary value is normalized before it enters the domain.
 */
// Intentional generic: callers select the canonical type after strict parsing.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function canonicalFromBoundary<Value>(input: unknown): Value {
  return omitUndefined(input) as Value;
}

function omitUndefined(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(omitUndefined);
  }
  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, omitUndefined(value)]),
    );
  }
  return input;
}
