import type { Degrees, NormalizedRatio } from "../../domain/common";
import { degrees, milliseconds, normalizedRatio } from "../../domain/factories";
import type {
  BrightnessCategory,
  FramingCondition,
  VideoFrameObservation,
  VideoThresholdSnapshot,
} from "../../domain/models";

export const VIDEO_METRIC_ALGORITHM_VERSION = "m08-video-conditions-v1";
export const MEDIAPIPE_TASKS_VISION_VERSION = "0.10.35";
export const FACE_LANDMARKER_MODEL_VERSION = "face_landmarker.float16.v1.task";

export const DEFAULT_VIDEO_THRESHOLDS: VideoThresholdSnapshot = Object.freeze({
  centringHorizontalTolerance: normalizedRatio(0.18),
  centringVerticalTolerance: normalizedRatio(0.2),
  nearCameraYawToleranceDegrees: degrees(18),
  nearCameraPitchToleranceDegrees: degrees(15),
  workableFaceAreaMinRatio: normalizedRatio(0.07),
  workableFaceAreaMaxRatio: normalizedRatio(0.42),
  dimLumaThreshold: normalizedRatio(0.22),
  brightLumaThreshold: normalizedRatio(0.78),
});

const EDGE_MIN = 0.02;
const EDGE_MAX = 0.98;
const CENTER_Y_TARGET = 0.45;
const COORDINATE_TOLERANCE = 0.1;
const PRIMARY_CONTINUITY_TOLERANCE = 0.2;

export interface NormalizedPoint {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

export interface FaceBounds {
  readonly minX: NormalizedRatio;
  readonly maxX: NormalizedRatio;
  readonly minY: NormalizedRatio;
  readonly maxY: NormalizedRatio;
  readonly width: NormalizedRatio;
  readonly height: NormalizedRatio;
  readonly centerX: NormalizedRatio;
  readonly centerY: NormalizedRatio;
  readonly area: NormalizedRatio;
}

export interface BrightnessSample {
  readonly meanLuma?: number | undefined;
  readonly lumaSpread?: number | undefined;
  readonly possibleBacklight?: boolean | undefined;
}

export interface VideoObservationInput {
  readonly frameId: number;
  readonly timestampOffsetMs: number;
  readonly faces: readonly (readonly NormalizedPoint[])[];
  readonly transformMatrices?: readonly MatrixLike[] | undefined;
  readonly brightness: BrightnessSample;
  readonly previousPrimaryBounds?: FaceBounds | undefined;
  readonly thresholds?: VideoThresholdSnapshot | undefined;
  readonly enableBacklightingLabel?: boolean | undefined;
}

export type MatrixLike =
  | readonly number[]
  | {
      readonly rows?: number | undefined;
      readonly columns?: number | undefined;
      readonly data?: readonly number[] | undefined;
    };

export interface OrientationEstimate {
  readonly yawDegrees: Degrees;
  readonly pitchDegrees: Degrees;
}

export function createVideoFrameObservation({
  brightness,
  enableBacklightingLabel = false,
  faces,
  frameId,
  previousPrimaryBounds,
  thresholds = DEFAULT_VIDEO_THRESHOLDS,
  timestampOffsetMs,
  transformMatrices = [],
}: VideoObservationInput): VideoFrameObservation {
  const faceCandidates = faces
    .map((landmarks, index) => ({
      index,
      bounds: calculateFaceBounds(landmarks),
    }))
    .filter(
      (
        candidate,
      ): candidate is { readonly index: number; readonly bounds: FaceBounds } =>
        candidate.bounds !== undefined,
    );
  const selected = selectPrimaryFace(faceCandidates, previousPrimaryBounds);
  const orientation = selected
    ? estimateOrientation(transformMatrices[selected.index])
    : undefined;
  const centred = selected
    ? isReasonablyCentred(selected.bounds, thresholds)
    : undefined;
  const nearCameraOrientation = orientation
    ? Math.abs(orientation.yawDegrees) <=
        thresholds.nearCameraYawToleranceDegrees &&
      Math.abs(orientation.pitchDegrees) <=
        thresholds.nearCameraPitchToleranceDegrees
    : undefined;

  return {
    frameId,
    timestampOffsetMs: milliseconds(Math.max(0, Math.round(timestampOffsetMs))),
    faceCount: normalizeFaceCount(faceCandidates.length),
    primaryFaceDetected: selected !== undefined,
    ...(centred === undefined ? {} : { centred }),
    ...(nearCameraOrientation === undefined ? {} : { nearCameraOrientation }),
    ...(orientation ? { yawDeltaDegrees: orientation.yawDegrees } : {}),
    ...(orientation ? { pitchDeltaDegrees: orientation.pitchDegrees } : {}),
    framing: selected
      ? classifyFraming(selected.bounds, thresholds)
      : "no-face-detected",
    brightness: classifyBrightness(
      brightness,
      thresholds,
      enableBacklightingLabel,
    ),
  };
}

export function calculateFaceBounds(
  landmarks: readonly NormalizedPoint[],
): FaceBounds | undefined {
  if (landmarks.length === 0) {
    return undefined;
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const landmark of landmarks) {
    if (!Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) {
      return undefined;
    }
    minX = Math.min(minX, landmark.x);
    maxX = Math.max(maxX, landmark.x);
    minY = Math.min(minY, landmark.y);
    maxY = Math.max(maxY, landmark.y);
  }

  const width = maxX - minX;
  const height = maxY - minY;
  if (
    width <= 0 ||
    height <= 0 ||
    minX < -COORDINATE_TOLERANCE ||
    minY < -COORDINATE_TOLERANCE ||
    maxX > 1 + COORDINATE_TOLERANCE ||
    maxY > 1 + COORDINATE_TOLERANCE
  ) {
    return undefined;
  }

  return {
    minX: clampRatio(minX),
    maxX: clampRatio(maxX),
    minY: clampRatio(minY),
    maxY: clampRatio(maxY),
    width: clampRatio(width),
    height: clampRatio(height),
    centerX: clampRatio(minX + width / 2),
    centerY: clampRatio(minY + height / 2),
    area: clampRatio(width * height),
  };
}

export function selectPrimaryFace(
  candidates: readonly {
    readonly index: number;
    readonly bounds: FaceBounds;
  }[],
  previousPrimaryBounds?: FaceBounds,
):
  | {
      readonly index: number;
      readonly bounds: FaceBounds;
    }
  | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  const byArea = [...candidates].sort((left, right) => {
    return right.bounds.area - left.bounds.area;
  });
  const largest = byArea[0];
  if (!largest || !previousPrimaryBounds) {
    return largest;
  }

  const continuous = candidates.find(({ bounds }) => {
    const centerDelta = Math.hypot(
      bounds.centerX - previousPrimaryBounds.centerX,
      bounds.centerY - previousPrimaryBounds.centerY,
    );
    const areaDelta =
      Math.abs(bounds.area - previousPrimaryBounds.area) /
      Math.max(previousPrimaryBounds.area, Number.EPSILON);
    return centerDelta <= PRIMARY_CONTINUITY_TOLERANCE && areaDelta <= 0.2;
  });

  return continuous ?? largest;
}

export function isReasonablyCentred(
  bounds: FaceBounds,
  thresholds = DEFAULT_VIDEO_THRESHOLDS,
): boolean {
  return (
    Math.abs(bounds.centerX - 0.5) <= thresholds.centringHorizontalTolerance &&
    Math.abs(bounds.centerY - CENTER_Y_TARGET) <=
      thresholds.centringVerticalTolerance
  );
}

export function classifyFraming(
  bounds: FaceBounds,
  thresholds = DEFAULT_VIDEO_THRESHOLDS,
): FramingCondition {
  if (
    bounds.minX <= EDGE_MIN ||
    bounds.maxX >= EDGE_MAX ||
    bounds.minY <= EDGE_MIN ||
    bounds.maxY >= EDGE_MAX
  ) {
    return "edge-or-partial";
  }

  if (bounds.area < thresholds.workableFaceAreaMinRatio) {
    return "too-far";
  }

  if (bounds.area > thresholds.workableFaceAreaMaxRatio) {
    return "too-close";
  }

  return "workable";
}

export function classifyBrightness(
  sample: BrightnessSample,
  thresholds = DEFAULT_VIDEO_THRESHOLDS,
  enableBacklightingLabel = false,
): BrightnessCategory {
  const mean = sample.meanLuma;
  const spread = sample.lumaSpread;
  if (!Number.isFinite(mean) || mean === undefined) {
    return "unknown";
  }

  if (
    enableBacklightingLabel &&
    sample.possibleBacklight === true &&
    Number.isFinite(spread)
  ) {
    return "possible-backlighting";
  }

  if (mean < thresholds.dimLumaThreshold) {
    return "dim";
  }

  if (mean > thresholds.brightLumaThreshold) {
    return "bright";
  }

  if (Number.isFinite(spread) && spread !== undefined && spread > 0.65) {
    return "uneven";
  }

  return "balanced";
}

export function estimateOrientation(
  matrix: MatrixLike | undefined,
): OrientationEstimate | undefined {
  const data = normalizeMatrixData(matrix);
  if (!data) {
    return undefined;
  }

  const m00 = data[0];
  const m20 = data[8];
  const m21 = data[9];
  const m22 = data[10];
  if (
    m00 === undefined ||
    m20 === undefined ||
    m21 === undefined ||
    m22 === undefined
  ) {
    return undefined;
  }

  const yaw = radiansToDegrees(Math.atan2(-m20, m00));
  const pitch = radiansToDegrees(Math.atan2(m21, m22));
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) {
    return undefined;
  }

  return {
    yawDegrees: degrees(yaw),
    pitchDegrees: degrees(pitch),
  };
}

function normalizeMatrixData(
  matrix: MatrixLike | undefined,
): readonly number[] | undefined {
  const data = Array.isArray(matrix)
    ? matrix
    : matrix && "data" in matrix
      ? matrix.data
      : undefined;
  if (!data || data.length < 16) {
    return undefined;
  }

  if (!Array.from(data).every(Number.isFinite)) {
    return undefined;
  }

  return data;
}

function normalizeFaceCount(count: number): 0 | 1 | 2 {
  if (count <= 0) {
    return 0;
  }
  if (count === 1) {
    return 1;
  }
  return 2;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function clampRatio(value: number): NormalizedRatio {
  return normalizedRatio(Math.min(1, Math.max(0, value)));
}
