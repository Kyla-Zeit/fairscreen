import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type Matrix,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

import {
  createVideoMetricsAggregator,
  type VideoMetricsAggregator,
} from "./aggregate";
import {
  createVideoFrameObservation,
  type BrightnessSample,
} from "./conditions";
import {
  isVideoWorkerRequest,
  type VideoWorkerConfig,
  type VideoWorkerRequest,
  type VideoWorkerResponse,
} from "./videoWorkerProtocol";

let config: VideoWorkerConfig | null = null;
let landmarker: FaceLandmarker | null = null;
let aggregator: VideoMetricsAggregator | null = null;
let disposed = false;
let lastTimestampMs = Number.NEGATIVE_INFINITY;

self.onmessage = (event: MessageEvent<unknown>) => {
  void handleMessage(event.data);
};

async function handleMessage(message: unknown) {
  if (!isVideoWorkerRequest(message)) {
    postError(
      "invalid-message",
      true,
      "Video worker ignored an invalid message.",
    );
    return;
  }

  switch (message.type) {
    case "init":
      await initialize(message.config);
      return;
    case "frame":
      analyzeFrame(message);
      return;
    case "reset-calibration":
      lastTimestampMs = Number.NEGATIVE_INFINITY;
      return;
    case "finalize":
      finalize(message);
      return;
    case "dispose":
      dispose();
      post({ type: "disposed" });
      return;
  }
}

async function initialize(nextConfig: VideoWorkerConfig) {
  try {
    assertSameOriginPath(nextConfig.wasmRootPath);
    assertSameOriginPath(nextConfig.modelAssetPath);
    disposed = false;
    config = nextConfig;
    aggregator = createVideoMetricsAggregator({
      targetSampleRateHz: nextConfig.targetSampleRateHz,
      thresholds: nextConfig.thresholds,
      modelVersion: nextConfig.modelVersion,
    });
    const fileset = await FilesetResolver.forVisionTasks(
      nextConfig.wasmRootPath,
    );
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: nextConfig.modelAssetPath,
      },
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      numFaces: 2,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO",
    });
    post({
      type: "ready",
      algorithmVersion: nextConfig.algorithmVersion,
      modelVersion: nextConfig.modelVersion,
    });
  } catch {
    disposeLandmarker();
    postError(
      "model-load-failed",
      true,
      "Local video analysis could not initialize.",
    );
  }
}

function analyzeFrame(message: Extract<VideoWorkerRequest, { type: "frame" }>) {
  const bitmap = message.bitmap;
  try {
    if (disposed || !landmarker || !config || !aggregator) {
      postError("worker-disposed", true, "Video analysis is no longer active.");
      return;
    }

    if (message.timestampMs <= lastTimestampMs) {
      aggregator.addDroppedFrames(1);
      return;
    }
    lastTimestampMs = message.timestampMs;

    const brightness = sampleBrightness(bitmap);
    const result = landmarker.detectForVideo(bitmap, message.timestampMs);
    const observation = createVideoFrameObservation({
      brightness,
      enableBacklightingLabel: config.enableBacklightingLabel,
      faces: normalizedFaces(result),
      frameId: message.frameId,
      thresholds: config.thresholds,
      timestampOffsetMs: message.timestampOffsetMs,
      transformMatrices: transformMatrices(result),
    });
    aggregator.addObservation(observation);
    post({ type: "observation", value: observation });
  } catch {
    aggregator?.addInvalidFrame();
    postError(
      "inference-failed",
      true,
      "Local video analysis skipped a frame.",
    );
  } finally {
    bitmap.close();
  }
}

function finalize(message: Extract<VideoWorkerRequest, { type: "finalize" }>) {
  if (!aggregator) {
    postError("worker-disposed", true, "Video analysis is no longer active.");
    return;
  }

  aggregator.addDroppedFrames(message.droppedFrameCount);
  for (let index = 0; index < message.invalidFrameCount; index += 1) {
    aggregator.addInvalidFrame();
  }
  post({ type: "final", metrics: aggregator.finalize() });
}

function dispose() {
  disposed = true;
  disposeLandmarker();
  config = null;
  aggregator = null;
  lastTimestampMs = Number.NEGATIVE_INFINITY;
}

function disposeLandmarker() {
  landmarker?.close();
  landmarker = null;
}

function sampleBrightness(bitmap: ImageBitmap): BrightnessSample {
  if (typeof OffscreenCanvas === "undefined") {
    return {};
  }

  const width = Math.max(1, Math.min(32, bitmap.width));
  const height = Math.max(1, Math.min(18, bitmap.height));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return {};
  }

  context.drawImage(bitmap, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  const lumaValues: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    lumaValues.push((0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255);
  }

  if (lumaValues.length === 0) {
    return {};
  }

  lumaValues.sort((left, right) => left - right);
  const meanLuma =
    lumaValues.reduce((sum, value) => sum + value, 0) / lumaValues.length;
  const p10 = lumaValues[Math.floor(lumaValues.length * 0.1)] ?? meanLuma;
  const p90 = lumaValues[Math.floor(lumaValues.length * 0.9)] ?? meanLuma;

  return {
    meanLuma,
    lumaSpread: p90 - p10,
  };
}

function normalizedFaces(
  result: FaceLandmarkerResult,
): readonly (readonly NormalizedLandmark[])[] {
  return result.faceLandmarks.slice(0, 2);
}

function transformMatrices(result: FaceLandmarkerResult): readonly Matrix[] {
  return result.facialTransformationMatrixes.slice(0, 2);
}

function assertSameOriginPath(path: string) {
  const url = new URL(path, self.location.origin);
  if (url.origin !== self.location.origin) {
    throw new TypeError("video-worker-asset-cross-origin");
  }
}

function post(message: VideoWorkerResponse) {
  self.postMessage(message);
}

function postError(
  code: Extract<VideoWorkerResponse, { type: "error" }>["code"],
  recoverable: boolean,
  message: string,
) {
  post({
    type: "error",
    code,
    recoverable,
    message,
  });
}
