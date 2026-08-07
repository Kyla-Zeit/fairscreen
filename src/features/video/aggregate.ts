import type {
  AvailabilityReason,
  Degrees,
  Hertz,
  MetricValue,
  Percentage,
} from "../../domain/common";
import { degrees, hertz, percentage } from "../../domain/factories";
import type {
  BrightnessCategory,
  CategoryDistribution,
  FramingCondition,
  VideoFrameObservation,
  VideoMetrics,
  VideoMetricWarning,
  VideoThresholdSnapshot,
} from "../../domain/models";
import {
  DEFAULT_VIDEO_THRESHOLDS,
  FACE_LANDMARKER_MODEL_VERSION,
  MEDIAPIPE_TASKS_VISION_VERSION,
  VIDEO_METRIC_ALGORITHM_VERSION,
} from "./conditions";

const MINIMUM_PERCENTAGE_FRAMES = 20;
const MANY_DROPPED_FRAME_RATIO = 0.2;
const PARTIAL_DROPPED_FRAME_RATIO = 0.5;
const VIDEO_LIMITATIONS = [
  "Video observations describe camera and lighting conditions only.",
  "Camera position, display placement, lighting, browser scheduling, and hardware can change these values.",
  "These values are not evidence of competence, honesty, suitability, emotion, identity, disability, or demographics.",
] as const;

export interface VideoMetricsAggregator {
  addObservation(observation: VideoFrameObservation): void;
  addDroppedFrames(count: number): void;
  addInvalidFrame(): void;
  finalize(input?: {
    readonly reason?: AvailabilityReason | undefined;
    readonly warning?: VideoMetricWarning | undefined;
  }): VideoMetrics;
  readonly processedFrameCount: number;
  readonly droppedFrameCount: number;
  readonly invalidFrameCount: number;
}

export interface CreateVideoMetricsAggregatorInput {
  readonly targetSampleRateHz?: Hertz | number | undefined;
  readonly thresholds?: VideoThresholdSnapshot | undefined;
  readonly modelVersion?: string | undefined;
}

export function createVideoMetricsAggregator({
  modelVersion = FACE_LANDMARKER_MODEL_VERSION,
  targetSampleRateHz = 8,
  thresholds = DEFAULT_VIDEO_THRESHOLDS,
}: CreateVideoMetricsAggregatorInput = {}): VideoMetricsAggregator {
  const observations: VideoFrameObservation[] = [];
  let droppedFrameCount = 0;
  let invalidFrameCount = 0;

  return {
    get processedFrameCount() {
      return observations.length;
    },
    get droppedFrameCount() {
      return droppedFrameCount;
    },
    get invalidFrameCount() {
      return invalidFrameCount;
    },
    addObservation(observation) {
      observations.push(observation);
    },
    addDroppedFrames(count) {
      if (Number.isSafeInteger(count) && count > 0) {
        droppedFrameCount += count;
      }
    },
    addInvalidFrame() {
      invalidFrameCount += 1;
    },
    finalize(input = {}) {
      return createVideoMetrics({
        observations,
        droppedFrameCount,
        invalidFrameCount,
        modelVersion,
        reason: input.reason,
        targetSampleRateHz,
        thresholds,
        warning: input.warning,
      });
    },
  };
}

export function createUnavailableVideoMetrics(
  reason: AvailabilityReason,
  targetSampleRateHz: Hertz | number = 8,
  warning?: VideoMetricWarning,
): VideoMetrics {
  return createVideoMetrics({
    observations: [],
    droppedFrameCount: 0,
    invalidFrameCount: 0,
    modelVersion: FACE_LANDMARKER_MODEL_VERSION,
    reason,
    targetSampleRateHz,
    thresholds: DEFAULT_VIDEO_THRESHOLDS,
    warning,
  });
}

function createVideoMetrics({
  droppedFrameCount,
  invalidFrameCount,
  modelVersion,
  observations,
  reason,
  targetSampleRateHz,
  thresholds,
  warning,
}: {
  readonly observations: readonly VideoFrameObservation[];
  readonly droppedFrameCount: number;
  readonly invalidFrameCount: number;
  readonly modelVersion: string;
  readonly reason?: AvailabilityReason | undefined;
  readonly targetSampleRateHz: Hertz | number;
  readonly thresholds: VideoThresholdSnapshot;
  readonly warning?: VideoMetricWarning | undefined;
}): VideoMetrics {
  const processedFrameCount = observations.length;
  const totalRequested = processedFrameCount + droppedFrameCount;
  const dropRatio = totalRequested > 0 ? droppedFrameCount / totalRequested : 0;
  const status =
    processedFrameCount === 0
      ? "unavailable"
      : reason !== undefined ||
          processedFrameCount < MINIMUM_PERCENTAGE_FRAMES ||
          dropRatio >= PARTIAL_DROPPED_FRAME_RATIO
        ? "partial"
        : "complete";
  const metricReason = reason ?? "insufficient-samples";
  const warnings = warningsFor({
    dropRatio,
    processedFrameCount,
    reason,
    warning,
    orientationSampleCount: observations.filter(
      (observation) => observation.nearCameraOrientation !== undefined,
    ).length,
  });
  const frameMetric = createPercentageMetricFactory({
    denominator: processedFrameCount,
    metricReason,
    status,
  });
  const faceFrames = observations.filter(
    (observation) => observation.primaryFaceDetected,
  );
  const orientationSamples = observations.filter(
    (observation) => observation.nearCameraOrientation !== undefined,
  );
  const yawSamples = observations.flatMap((observation) =>
    observation.yawDeltaDegrees === undefined
      ? []
      : [Number(observation.yawDeltaDegrees)],
  );
  const pitchSamples = observations.flatMap((observation) =>
    observation.pitchDeltaDegrees === undefined
      ? []
      : [Number(observation.pitchDeltaDegrees)],
  );

  return {
    algorithmVersion: VIDEO_METRIC_ALGORITHM_VERSION,
    modelVersion: `${modelVersion};tasks-vision-${MEDIAPIPE_TASKS_VISION_VERSION}`,
    status,
    targetSampleRateHz: hertz(Number(targetSampleRateHz)),
    processedFrameCount,
    droppedFrameCount,
    invalidFrameCount,
    faceDetectionPercentage: frameMetric(
      observations.filter((observation) => observation.primaryFaceDetected)
        .length,
    ),
    singleFacePercentage: frameMetric(
      observations.filter((observation) => observation.faceCount === 1).length,
    ),
    multipleFacePercentage: frameMetric(
      observations.filter((observation) => observation.faceCount === 2).length,
    ),
    reasonableCentringPercentage: createPercentageMetric({
      count: faceFrames.filter((observation) => observation.centred === true)
        .length,
      denominator: faceFrames.length,
      reason: metricReason,
      status,
    }),
    nearCameraOrientationPercentage: createPercentageMetric({
      count: orientationSamples.filter(
        (observation) => observation.nearCameraOrientation === true,
      ).length,
      denominator: orientationSamples.length,
      reason: metricReason,
      status:
        orientationSamples.length >= MINIMUM_PERCENTAGE_FRAMES
          ? status
          : "unavailable",
    }),
    medianYawDeltaDegrees: createDegreesMetric({
      reason: metricReason,
      status:
        yawSamples.length >= MINIMUM_PERCENTAGE_FRAMES ? status : "unavailable",
      value: median(yawSamples),
    }),
    medianPitchDeltaDegrees: createDegreesMetric({
      reason: metricReason,
      status:
        pitchSamples.length >= MINIMUM_PERCENTAGE_FRAMES
          ? status
          : "unavailable",
      value: median(pitchSamples),
    }),
    framing: createDistributionMetric({
      counts: countCategories(observations, "framing", framingCategories),
      reason: metricReason,
      status,
    }),
    brightness: createDistributionMetric({
      counts: countCategories(observations, "brightness", brightnessCategories),
      reason: metricReason,
      status,
    }),
    ...(orientationSamples.length > 0
      ? {
          orientationCalibration: {
            sampleCount: orientationSamples.length,
            baselineYawDegrees: degrees(0),
            baselinePitchDegrees: degrees(0),
            calibrationQuality:
              orientationSamples.length >= MINIMUM_PERCENTAGE_FRAMES
                ? "adequate"
                : "unavailable",
          },
        }
      : {}),
    thresholds,
    warnings,
  };
}

function warningsFor({
  dropRatio,
  orientationSampleCount,
  processedFrameCount,
  reason,
  warning,
}: {
  readonly processedFrameCount: number;
  readonly dropRatio: number;
  readonly orientationSampleCount: number;
  readonly reason?: AvailabilityReason | undefined;
  readonly warning?: VideoMetricWarning | undefined;
}): readonly VideoMetricWarning[] {
  const warnings = new Set<VideoMetricWarning>(["model-preview"]);

  if (
    processedFrameCount > 0 &&
    processedFrameCount < MINIMUM_PERCENTAGE_FRAMES
  ) {
    warnings.add("low-sample-count");
  }

  if (dropRatio >= MANY_DROPPED_FRAME_RATIO) {
    warnings.add("many-dropped-frames");
  }

  if (processedFrameCount > 0 && reason !== undefined) {
    warnings.add("partial-samples");
  }

  if (orientationSampleCount < MINIMUM_PERCENTAGE_FRAMES) {
    warnings.add("orientation-unavailable");
  }

  switch (reason) {
    case "device-lost":
    case "interrupted":
      warnings.add("device-lost");
      break;
    case "initialization-failed":
    case "unsupported":
      warnings.add("worker-unavailable");
      break;
    default:
      break;
  }

  if (warning) {
    warnings.add(warning);
  }

  return Array.from(warnings);
}

function createPercentageMetricFactory({
  denominator,
  metricReason,
  status,
}: {
  readonly denominator: number;
  readonly metricReason: AvailabilityReason;
  readonly status: VideoMetrics["status"];
}) {
  return (count: number) =>
    createPercentageMetric({
      count,
      denominator,
      reason: metricReason,
      status: denominator >= MINIMUM_PERCENTAGE_FRAMES ? status : "unavailable",
    });
}

function createPercentageMetric({
  count,
  denominator,
  reason,
  status,
}: {
  readonly count: number;
  readonly denominator: number;
  readonly reason: AvailabilityReason;
  readonly status: VideoMetrics["status"];
}): MetricValue<Percentage> {
  if (denominator <= 0 || status === "unavailable") {
    return {
      status: "unavailable",
      reason,
      limitations: VIDEO_LIMITATIONS,
    };
  }

  const value = percentage((count / denominator) * 100);
  if (status === "partial") {
    return {
      status: "partial",
      value,
      calculationQuality: "limited",
      reason,
      limitations: VIDEO_LIMITATIONS,
    };
  }

  return {
    status: "available",
    value,
    calculationQuality: "adequate",
    limitations: VIDEO_LIMITATIONS,
  };
}

function createDegreesMetric({
  reason,
  status,
  value,
}: {
  readonly value: number | undefined;
  readonly reason: AvailabilityReason;
  readonly status: VideoMetrics["status"];
}): MetricValue<Degrees> {
  if (value === undefined || status === "unavailable") {
    return {
      status: "unavailable",
      reason,
      limitations: VIDEO_LIMITATIONS,
    };
  }

  if (status === "partial") {
    return {
      status: "partial",
      value: degrees(value),
      calculationQuality: "limited",
      reason,
      limitations: VIDEO_LIMITATIONS,
    };
  }

  return {
    status: "available",
    value: degrees(value),
    calculationQuality: "adequate",
    limitations: VIDEO_LIMITATIONS,
  };
}

function createDistributionMetric<Category extends string>({
  counts,
  reason,
  status,
}: {
  readonly counts: Readonly<Record<Category, number>>;
  readonly reason: AvailabilityReason;
  readonly status: VideoMetrics["status"];
}): MetricValue<CategoryDistribution<Category>> {
  let total = 0;
  for (const count of Object.values(counts)) {
    if (typeof count === "number") {
      total += count;
    }
  }
  if (total <= 0 || status === "unavailable") {
    return {
      status: "unavailable",
      reason,
      limitations: VIDEO_LIMITATIONS,
    };
  }

  const value = {
    counts,
    dominant: dominantCategory(counts),
  };

  if (status === "partial") {
    return {
      status: "partial",
      value,
      calculationQuality: "limited",
      reason,
      limitations: VIDEO_LIMITATIONS,
    };
  }

  return {
    status: "available",
    value,
    calculationQuality: "adequate",
    limitations: VIDEO_LIMITATIONS,
  };
}

function countCategories<
  Observation extends VideoFrameObservation,
  Key extends "framing" | "brightness",
  Category extends Observation[Key],
>(
  observations: readonly Observation[],
  key: Key,
  categories: readonly Category[],
): Record<Category, number> {
  const counts = Object.fromEntries(
    categories.map((category) => [category, 0]),
  ) as Record<Category, number>;

  for (const observation of observations) {
    counts[observation[key] as Category] += 1;
  }

  return counts;
}

function dominantCategory<Category extends string>(
  counts: Readonly<Record<Category, number>>,
): Category {
  const [first] = Object.keys(counts) as Category[];
  if (!first) {
    throw new Error("category-distribution-empty");
  }

  return (Object.entries(counts) as [Category, number][]).reduce(
    (best, current) => (current[1] > best[1] ? current : best),
    [first, counts[first]],
  )[0];
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : sorted[middle];
  return value;
}

const framingCategories = [
  "workable",
  "too-close",
  "too-far",
  "edge-or-partial",
  "no-face-detected",
  "unknown",
] as const satisfies readonly FramingCondition[];

const brightnessCategories = [
  "dim",
  "balanced",
  "bright",
  "possible-backlighting",
  "uneven",
  "unknown",
] as const satisfies readonly BrightnessCategory[];
