import type { FairnessTrialId, MetricValue } from "../../domain/common";
import {
  degrees,
  fairnessComparisonId,
  fairnessGroupId,
  fairnessTrialId,
  hertz,
  interviewQuestionId,
  isoDateTime,
  normalizedRatio,
  percentage,
  sha256Digest,
  transcriptRevisionId,
} from "../../domain/factories";
import { APPROVED_INVARIANT_MESSAGE } from "../../domain/invariants";
import type {
  BrightnessCategory,
  CategoryDistribution,
  FairnessComparison,
  FairnessConditionPreset,
  FairnessTrial,
  FramingCondition,
  InterviewQuestion,
  VideoMetrics,
} from "../../domain/models";
import type {
  DeletionSummary,
  FairScreenRepository,
  StorageResult,
} from "../../domain/ports";

const DEMO_TIMESTAMP = isoDateTime("2026-01-01T00:00:00.000Z");
const DEMO_DIGEST = sha256Digest(
  "50fba1fe16a08d5cc55d078961132771ae345c2f64657d7e3babd8403168a2c2",
);
const DEMO_TRANSCRIPT_ID = transcriptRevisionId("demo:transcript:shared");
export const DEMO_COMPARISON_ID = fairnessComparisonId(
  "demo:comparison:conditions",
);
const DEMO_GROUP_ID = fairnessGroupId("demo:group:conditions");

const demoQuestion: InterviewQuestion = {
  id: interviewQuestionId("demo:question:collaboration"),
  source: "built-in",
  text: "Tell me about a time you solved a difficult problem. What did you personally do?",
  normalizedText:
    "tell me about a time you solved a difficult problem what did you personally do",
  category: "software-technical",
  difficulty: "standard",
  tags: ["problem-solving", "debugging", "testing"],
  renderedKeywords: [],
  order: 0,
  providerId: "fairscreen-demo",
  providerVersion: "1.0.0",
};

export const DEMO_TRANSCRIPT =
  "In a class scheduling project, users were sometimes seeing duplicate appointments after a slow network response. I reproduced the issue, traced it to two requests updating the same local record, and added an idempotency check before the save. I also wrote a regression test that simulated the delayed response. The duplicate rate in our test run went from 7 out of 50 attempts to zero, and the test stayed in the automated suite so the issue would be caught before future releases.";

interface DemoCondition {
  readonly id: string;
  readonly preset: FairnessConditionPreset;
  readonly label: string;
  readonly faceDetection: number;
  readonly centring: number;
  readonly orientation: number;
  readonly framing: FramingCondition;
  readonly framingPercentage: number;
  readonly brightness: BrightnessCategory;
  readonly brightnessPercentage: number;
}

const demoConditions: readonly DemoCondition[] = [
  {
    id: "near-camera",
    preset: "near-camera",
    label: "Camera near the displayed question",
    faceDetection: 98,
    centring: 94,
    orientation: 88,
    framing: "workable",
    framingPercentage: 92,
    brightness: "balanced",
    brightnessPercentage: 86,
  },
  {
    id: "looking-at-question",
    preset: "looking-at-question",
    label: "Reading the question on screen",
    faceDetection: 96,
    centring: 84,
    orientation: 42,
    framing: "workable",
    framingPercentage: 90,
    brightness: "balanced",
    brightnessPercentage: 84,
  },
  {
    id: "side-camera",
    preset: "side-camera",
    label: "Camera positioned beside the display",
    faceDetection: 90,
    centring: 38,
    orientation: 31,
    framing: "edge-or-partial",
    framingPercentage: 56,
    brightness: "balanced",
    brightnessPercentage: 78,
  },
  {
    id: "dim-lighting",
    preset: "dim-lighting",
    label: "Dim room lighting",
    faceDetection: 67,
    centring: 73,
    orientation: 70,
    framing: "workable",
    framingPercentage: 75,
    brightness: "dim",
    brightnessPercentage: 88,
  },
];

export const DEMO_TRIAL_IDS = demoConditions.map((condition) =>
  fairnessTrialId(`demo:trial:${condition.id}`),
);

export const DEMO_TRIALS: readonly FairnessTrial[] = demoConditions.map(
  (condition, index) => ({
    schemaVersion: 1,
    id: DEMO_TRIAL_IDS[index] ?? fairnessTrialId(`demo:trial:${index}`),
    groupId: DEMO_GROUP_ID,
    comparisonId: DEMO_COMPARISON_ID,
    question: demoQuestion,
    condition: {
      preset: condition.preset,
      label: condition.label,
      source: "seeded-demo",
    },
    source: "seeded-demo",
    content: {
      transcriptRevisionId: DEMO_TRANSCRIPT_ID,
      transcriptDigest: DEMO_DIGEST,
      normalizedText: DEMO_TRANSCRIPT.toLocaleLowerCase("en"),
      wordCount: 82,
      relevance: "strong",
      specificity: "strong",
      personalContribution: "strong",
      outcome: "strong",
      starElementsDetected: ["situation", "action", "result"],
    },
    videoMetrics: createVideoMetrics(condition),
    isDemo: true,
    createdAt: DEMO_TIMESTAMP,
    updatedAt: DEMO_TIMESTAMP,
  }),
);

const sourceTranscriptRevisions = Object.fromEntries(
  DEMO_TRIAL_IDS.map((id) => [id, DEMO_TRANSCRIPT_ID]),
) as Readonly<Record<FairnessTrialId, typeof DEMO_TRANSCRIPT_ID>>;

const pairs = DEMO_TRIAL_IDS.flatMap((left, leftIndex) =>
  DEMO_TRIAL_IDS.slice(leftIndex + 1).map((right) => ({
    leftTrialId: left,
    rightTrialId: right,
    band: "exact" as const,
    normalizedExactMatch: true,
    cosineUnigramSimilarity: normalizedRatio(1),
    trigramJaccardSimilarity: normalizedRatio(1),
    weightedSimilarity: normalizedRatio(1),
    wordCountDifferencePercentage: percentage(0),
  })),
);

export const DEMO_COMPARISON: FairnessComparison = {
  schemaVersion: 1,
  id: DEMO_COMPARISON_ID,
  groupId: DEMO_GROUP_ID,
  status: "current",
  title: "Same answer, different video-call conditions",
  question: demoQuestion,
  trialIds: DEMO_TRIAL_IDS,
  sourceTranscriptRevisions,
  algorithmVersion: "fairness-similarity-1.0.0",
  content: {
    pairwise: pairs,
    allContentInvariant: true,
    invariantBand: "exact",
    categoryComparison: [
      {
        category: "word-count",
        values: trialValues(82),
      },
      {
        category: "question-relevance",
        values: trialValues("strong"),
      },
      {
        category: "specificity",
        values: trialValues("strong"),
      },
      {
        category: "personal-contribution",
        values: trialValues("strong"),
      },
      {
        category: "outcome",
        values: trialValues("strong"),
      },
      {
        category: "star-elements",
        values: trialValues(["situation", "action", "result"]),
      },
    ],
  },
  videoConditions: {
    availableTrialIds: DEMO_TRIAL_IDS,
    unavailableTrialIds: [],
    rows: [
      {
        metric: "face-detection",
        values: valuesFromConditions((condition) => condition.faceDetection),
      },
      {
        metric: "centring",
        values: valuesFromConditions((condition) => condition.centring),
      },
      {
        metric: "near-camera-orientation",
        values: valuesFromConditions((condition) => condition.orientation),
      },
      {
        metric: "framing",
        values: valuesFromConditions((condition) => condition.framing),
      },
      {
        metric: "brightness",
        values: valuesFromConditions((condition) => condition.brightness),
      },
      { metric: "multiple-face", values: trialValues(0) },
    ],
  },
  approvedInvariantMessage: APPROVED_INVARIANT_MESSAGE,
  summary:
    "The reviewed answer is identical in every synthetic trial while the descriptive video-call conditions vary.",
  limitations: [
    "Synthetic records demonstrate data separation; they are not participant research.",
    "This small comparison cannot establish causality or audit another system.",
  ],
  isDemo: true,
  createdAt: DEMO_TIMESTAMP,
  updatedAt: DEMO_TIMESTAMP,
};

export async function seedDemoData(
  repository: FairScreenRepository,
): Promise<StorageResult<{ readonly loaded: boolean }>> {
  const existing = await repository.getFairnessComparison(DEMO_COMPARISON_ID);
  if (!existing.ok) return existing;
  if (existing.value) {
    return existing.value.isDemo
      ? { ok: true, value: { loaded: false } }
      : {
          ok: false,
          error: {
            code: "record-corrupt",
            operation: "seed-demo",
            recoverable: true,
            actions: ["export"],
          },
        };
  }
  const saved = await repository.saveFairnessComparison(
    DEMO_COMPARISON,
    DEMO_TRIALS,
  );
  return saved.ok ? { ok: true, value: { loaded: true } } : saved;
}

export function removeDemoData(
  repository: FairScreenRepository,
): Promise<StorageResult<DeletionSummary>> {
  return repository.delete({ kind: "demo-data" });
}

function available<Value>(value: Value): MetricValue<Value> {
  return {
    status: "available",
    value,
    calculationQuality: "adequate",
    limitations: [],
  };
}

function createVideoMetrics(condition: DemoCondition): VideoMetrics {
  const framing: CategoryDistribution<FramingCondition> = {
    counts: {
      workable:
        condition.framing === "workable" ? condition.framingPercentage : 0,
      "too-close": 0,
      "too-far": 0,
      "edge-or-partial":
        condition.framing === "edge-or-partial"
          ? condition.framingPercentage
          : 0,
      "no-face-detected": 0,
      unknown: 100 - condition.framingPercentage,
    },
    dominant: condition.framing,
  };
  const brightness: CategoryDistribution<BrightnessCategory> = {
    counts: {
      dim: condition.brightness === "dim" ? condition.brightnessPercentage : 0,
      balanced:
        condition.brightness === "balanced"
          ? condition.brightnessPercentage
          : 0,
      bright: 0,
      "possible-backlighting": 0,
      uneven: 0,
      unknown: 100 - condition.brightnessPercentage,
    },
    dominant: condition.brightness,
  };

  return {
    algorithmVersion: "video-demo-1.0.0",
    modelVersion: "synthetic-no-model",
    status: "complete",
    targetSampleRateHz: hertz(8),
    processedFrameCount: 100,
    droppedFrameCount: 0,
    invalidFrameCount: 0,
    faceDetectionPercentage: available(percentage(condition.faceDetection)),
    singleFacePercentage: available(percentage(condition.faceDetection)),
    multipleFacePercentage: available(percentage(0)),
    reasonableCentringPercentage: available(percentage(condition.centring)),
    nearCameraOrientationPercentage: available(
      percentage(condition.orientation),
    ),
    medianYawDeltaDegrees: available(
      degrees(Math.max(0, 25 - condition.orientation / 5)),
    ),
    medianPitchDeltaDegrees: available(degrees(4)),
    framing: available(framing),
    brightness: available(brightness),
    thresholds: {
      centringHorizontalTolerance: normalizedRatio(0.12),
      centringVerticalTolerance: normalizedRatio(0.14),
      nearCameraYawToleranceDegrees: degrees(15),
      nearCameraPitchToleranceDegrees: degrees(12),
      workableFaceAreaMinRatio: normalizedRatio(0.08),
      workableFaceAreaMaxRatio: normalizedRatio(0.42),
      dimLumaThreshold: normalizedRatio(0.2),
      brightLumaThreshold: normalizedRatio(0.85),
    },
    warnings: ["model-preview"],
  };
}

function trialValues<Value extends string | number | readonly string[]>(
  value: Value,
): Readonly<Record<FairnessTrialId, Value>> {
  return Object.fromEntries(DEMO_TRIAL_IDS.map((id) => [id, value]));
}

function valuesFromConditions<Value extends string | number>(
  select: (condition: DemoCondition) => Value,
): Readonly<Record<FairnessTrialId, Value>> {
  return Object.fromEntries(
    demoConditions.map((condition, index) => [
      DEMO_TRIAL_IDS[index],
      select(condition),
    ]),
  ) as Readonly<Record<FairnessTrialId, Value>>;
}
