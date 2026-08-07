import type { Hertz } from "../../domain/common";
import type {
  VideoFrameObservation,
  VideoMetrics,
  VideoThresholdSnapshot,
} from "../../domain/models";
import { DEFAULT_VIDEO_THRESHOLDS } from "./conditions";

export type VideoWorkerErrorCode =
  | "invalid-message"
  | "unsupported-frame-transfer"
  | "model-load-failed"
  | "inference-failed"
  | "worker-disposed";

export interface VideoWorkerConfig {
  readonly wasmRootPath: string;
  readonly modelAssetPath: string;
  readonly targetSampleRateHz: Hertz | number;
  readonly algorithmVersion: string;
  readonly modelVersion: string;
  readonly thresholds: VideoThresholdSnapshot;
  readonly enableBacklightingLabel: boolean;
}

export type VideoWorkerRequest =
  | {
      readonly type: "init";
      readonly config: VideoWorkerConfig;
    }
  | {
      readonly type: "frame";
      readonly frameId: number;
      readonly timestampMs: number;
      readonly timestampOffsetMs: number;
      readonly bitmap: ImageBitmap;
    }
  | {
      readonly type: "reset-calibration";
      readonly timestampMs: number;
    }
  | {
      readonly type: "finalize";
      readonly droppedFrameCount: number;
      readonly invalidFrameCount: number;
    }
  | {
      readonly type: "dispose";
    };

export type VideoWorkerResponse =
  | {
      readonly type: "ready";
      readonly algorithmVersion: string;
      readonly modelVersion: string;
    }
  | {
      readonly type: "observation";
      readonly value: VideoFrameObservation;
    }
  | {
      readonly type: "final";
      readonly metrics: VideoMetrics;
    }
  | {
      readonly type: "error";
      readonly code: VideoWorkerErrorCode;
      readonly recoverable: boolean;
      readonly message: string;
    }
  | {
      readonly type: "disposed";
    };

export function createDefaultVideoWorkerConfig(input: {
  readonly wasmRootPath: string;
  readonly modelAssetPath: string;
  readonly targetSampleRateHz: Hertz | number;
  readonly algorithmVersion: string;
  readonly modelVersion: string;
  readonly enableBacklightingLabel?: boolean | undefined;
}): VideoWorkerConfig {
  return {
    ...input,
    thresholds: DEFAULT_VIDEO_THRESHOLDS,
    enableBacklightingLabel: input.enableBacklightingLabel ?? false,
  };
}

export function parseVideoWorkerResponse(
  message: unknown,
): VideoWorkerResponse {
  assertNoRawVideoFields(message, "worker-response");

  if (!isRecord(message) || typeof message.type !== "string") {
    throw new TypeError("video-worker-response-invalid");
  }

  switch (message.type) {
    case "ready":
      if (
        typeof message.algorithmVersion === "string" &&
        typeof message.modelVersion === "string"
      ) {
        return message as VideoWorkerResponse;
      }
      break;
    case "observation":
      if (isVideoFrameObservation(message.value)) {
        return message as VideoWorkerResponse;
      }
      break;
    case "final":
      if (isRecord(message.metrics)) {
        return message as VideoWorkerResponse;
      }
      break;
    case "error":
      if (
        isVideoWorkerErrorCode(message.code) &&
        typeof message.recoverable === "boolean" &&
        typeof message.message === "string"
      ) {
        return message as VideoWorkerResponse;
      }
      break;
    case "disposed":
      return message as VideoWorkerResponse;
    default:
      break;
  }

  throw new TypeError("video-worker-response-invalid");
}

export function assertNoRawVideoFields(value: unknown, context = "value") {
  inspectForRawVideoFields(value, new WeakSet<object>(), [context]);
}

export function isVideoWorkerRequest(
  value: unknown,
): value is VideoWorkerRequest {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "init":
      return isWorkerConfig(value.config);
    case "frame":
      return (
        Number.isSafeInteger(value.frameId) &&
        Number.isFinite(value.timestampMs) &&
        Number.isFinite(value.timestampOffsetMs) &&
        isImageBitmapLike(value.bitmap)
      );
    case "reset-calibration":
      return Number.isFinite(value.timestampMs);
    case "finalize":
      if (
        typeof value.droppedFrameCount !== "number" ||
        typeof value.invalidFrameCount !== "number"
      ) {
        return false;
      }
      return (
        Number.isSafeInteger(value.droppedFrameCount) &&
        value.droppedFrameCount >= 0 &&
        Number.isSafeInteger(value.invalidFrameCount) &&
        value.invalidFrameCount >= 0
      );
    case "dispose":
      return true;
    default:
      return false;
  }
}

function isVideoFrameObservation(
  value: unknown,
): value is VideoFrameObservation {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isSafeInteger(value.frameId) &&
    Number.isFinite(value.timestampOffsetMs) &&
    (value.faceCount === 0 || value.faceCount === 1 || value.faceCount === 2) &&
    typeof value.primaryFaceDetected === "boolean" &&
    typeof value.framing === "string" &&
    typeof value.brightness === "string"
  );
}

function isWorkerConfig(value: unknown): value is VideoWorkerConfig {
  return (
    isRecord(value) &&
    typeof value.wasmRootPath === "string" &&
    typeof value.modelAssetPath === "string" &&
    Number.isFinite(value.targetSampleRateHz) &&
    typeof value.algorithmVersion === "string" &&
    typeof value.modelVersion === "string" &&
    isRecord(value.thresholds) &&
    typeof value.enableBacklightingLabel === "boolean"
  );
}

function isImageBitmapLike(value: unknown): value is ImageBitmap {
  return (
    typeof value === "object" &&
    value !== null &&
    "close" in value &&
    typeof (value as { close?: unknown }).close === "function"
  );
}

function isVideoWorkerErrorCode(value: unknown): value is VideoWorkerErrorCode {
  return (
    value === "invalid-message" ||
    value === "unsupported-frame-transfer" ||
    value === "model-load-failed" ||
    value === "inference-failed" ||
    value === "worker-disposed"
  );
}

function inspectForRawVideoFields(
  value: unknown,
  visited: WeakSet<object>,
  path: readonly string[],
): void {
  if (value === null || typeof value !== "object") {
    return;
  }

  if (visited.has(value)) {
    return;
  }
  visited.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      inspectForRawVideoFields(item, visited, path);
    }
    visited.delete(value);
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (rawVideoResponseKeyPattern.test(key)) {
      throw new TypeError(`video-worker-raw-field:${path.join(".")}.${key}`);
    }
    inspectForRawVideoFields(nested, visited, [...path, key]);
  }
  visited.delete(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const rawVideoResponseKeyPattern =
  /^(?:frame|frames|image|images|imageData|pixels?|landmarks?|faceLandmarks|blendshapes?|matrix|matrices|facialTransformationMatrixes|embedding)$/i;
