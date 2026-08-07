import { describe, expect, it, vi } from "vitest";

import { hertz } from "../../domain/factories";
import {
  FACE_LANDMARKER_MODEL_VERSION,
  VIDEO_METRIC_ALGORITHM_VERSION,
} from "./conditions";
import {
  createDefaultVideoWorkerConfig,
  isVideoWorkerRequest,
  parseVideoWorkerResponse,
} from "./videoWorkerProtocol";

describe("video worker protocol", () => {
  it("accepts typed init, frame, finalize, and dispose requests", () => {
    expect(
      isVideoWorkerRequest({
        type: "init",
        config: createDefaultVideoWorkerConfig({
          algorithmVersion: VIDEO_METRIC_ALGORITHM_VERSION,
          modelAssetPath: "/fairscreen/mediapipe/models/face_landmarker.task",
          modelVersion: FACE_LANDMARKER_MODEL_VERSION,
          targetSampleRateHz: hertz(8),
          wasmRootPath: "/fairscreen/mediapipe/wasm",
        }),
      }),
    ).toBe(true);
    expect(
      isVideoWorkerRequest({
        type: "frame",
        frameId: 1,
        timestampMs: 120,
        timestampOffsetMs: 120,
        bitmap: { close: vi.fn() } as unknown as ImageBitmap,
      }),
    ).toBe(true);
    expect(
      isVideoWorkerRequest({
        type: "finalize",
        droppedFrameCount: 1,
        invalidFrameCount: 0,
      }),
    ).toBe(true);
    expect(isVideoWorkerRequest({ type: "dispose" })).toBe(true);
  });

  it("rejects invalid counts and unsafe response fields", () => {
    expect(
      isVideoWorkerRequest({
        type: "finalize",
        droppedFrameCount: -1,
        invalidFrameCount: 0,
      }),
    ).toBe(false);

    expect(() =>
      parseVideoWorkerResponse({
        type: "observation",
        value: {
          frameId: 1,
          timestampOffsetMs: 0,
          faceCount: 1,
          primaryFaceDetected: true,
          framing: "workable",
          brightness: "balanced",
          landmarks: [{ x: 0.5, y: 0.5 }],
        },
      }),
    ).toThrow(/video-worker-raw-field/);
    expect(() =>
      parseVideoWorkerResponse({
        type: "final",
        metrics: {
          facialTransformationMatrixes: [1, 0, 0, 1],
        },
      }),
    ).toThrow(/video-worker-raw-field/);
  });

  it("parses aggregate-only worker messages", () => {
    expect(
      parseVideoWorkerResponse({
        type: "observation",
        value: {
          frameId: 1,
          timestampOffsetMs: 0,
          faceCount: 0,
          primaryFaceDetected: false,
          framing: "no-face-detected",
          brightness: "unknown",
        },
      }),
    ).toMatchObject({ type: "observation" });
    expect(
      parseVideoWorkerResponse({
        type: "error",
        code: "model-load-failed",
        recoverable: true,
        message: "Local video analysis could not initialize.",
      }),
    ).toMatchObject({ type: "error", recoverable: true });
  });
});
