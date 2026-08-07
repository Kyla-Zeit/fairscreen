import { describe, expect, it, vi } from "vitest";

import { milliseconds } from "../../domain/factories";
import type { VideoMetrics } from "../../domain/models";
import { createVideoMetricsAggregator } from "../../features/video/aggregate";
import type { VideoWorkerResponse } from "../../features/video/videoWorkerProtocol";
import {
  startBrowserVideoAnalysisSession,
  type VideoAnalysisWorkerLike,
} from "./videoAnalysisClient";

describe("browser video analysis client", () => {
  it("starts lazily, drops stale frames at queue depth one, and finalizes", async () => {
    const scheduler = createScheduler();
    const createImageBitmap = vi.fn(() => Promise.resolve(createBitmap()));
    const video = createReadyVideo();
    FakeWorker.mode = "ready";
    FakeWorker.instances = [];

    expect(FakeWorker.instances).toHaveLength(0);

    const result = await startBrowserVideoAnalysisSession({
      environment: {
        createWorker: () => new FakeWorker(),
        createImageBitmap,
        ...scheduler.environment,
      },
      nowMs: createNow([125, 250, 375]),
      startedAtMs: 0,
      videoElement: video,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const worker = FakeWorker.instances[0];
    expect(worker?.messages[0]).toMatchObject({
      type: "init",
      config: {
        modelAssetPath: "/fairscreen/mediapipe/models/face_landmarker.task",
        wasmRootPath: "/fairscreen/mediapipe/wasm",
      },
    });

    scheduler.runInterval();
    await Promise.resolve();
    expect(createImageBitmap).toHaveBeenCalledTimes(1);
    expect(worker?.messages.at(-1)).toMatchObject({ type: "frame" });

    scheduler.runInterval();
    await Promise.resolve();
    expect(createImageBitmap).toHaveBeenCalledTimes(1);

    worker?.emit({
      type: "observation",
      value: {
        frameId: 0,
        timestampOffsetMs: milliseconds(125),
        faceCount: 1,
        primaryFaceDetected: true,
        centred: true,
        framing: "workable",
        brightness: "balanced",
      },
    });

    const stopPromise = result.session.stop(1_000);
    const finalizeMessage = worker?.messages.find(
      (
        message,
      ): message is {
        readonly type: "finalize";
        readonly droppedFrameCount: number;
      } => isRecord(message) && message.type === "finalize",
    );
    expect(finalizeMessage?.droppedFrameCount).toBe(1);
    worker?.emit({
      type: "final",
      metrics: syntheticVideoMetrics(finalizeMessage?.droppedFrameCount ?? 0),
    });

    const metrics = await stopPromise;
    expect(metrics.status).toBe("partial");
    expect(metrics.droppedFrameCount).toBe(1);
    expect(worker?.terminated).toBe(true);
  });

  it("returns unavailable when the worker model fails to initialize", async () => {
    FakeWorker.mode = "fail-init";
    FakeWorker.instances = [];

    const result = await startBrowserVideoAnalysisSession({
      environment: {
        createWorker: () => new FakeWorker(),
        createImageBitmap: vi.fn(() => Promise.resolve(createBitmap())),
        ...createScheduler().environment,
      },
      nowMs: () => 0,
      startedAtMs: 0,
      videoElement: createReadyVideo(),
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "initialization-failed",
      warning: "model-load-failed",
    });
    expect(FakeWorker.instances[0]?.terminated).toBe(true);
  });
});

class FakeWorker implements VideoAnalysisWorkerLike {
  static instances: FakeWorker[] = [];
  static mode: "ready" | "fail-init" = "ready";

  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly messages: unknown[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown) {
    this.messages.push(message);
    if (!isRecord(message) || message.type !== "init") {
      return;
    }

    queueMicrotask(() => {
      if (FakeWorker.mode === "fail-init") {
        this.emit({
          type: "error",
          code: "model-load-failed",
          recoverable: true,
          message: "Local video analysis could not initialize.",
        });
        return;
      }

      this.emit({
        type: "ready",
        algorithmVersion: "m08-video-conditions-v1",
        modelVersion: "face_landmarker.float16.v1.task",
      });
    });
  }

  terminate() {
    this.terminated = true;
  }

  emit(message: VideoWorkerResponse) {
    this.onmessage?.({ data: message } as MessageEvent<unknown>);
  }
}

function createScheduler() {
  let intervalCallback: (() => void) | undefined;
  const setInterval = ((handler: TimerHandler) => {
    if (typeof handler === "function") {
      const callback = handler as () => void;
      intervalCallback = () => {
        callback();
      };
    }
    return 1;
  }) as typeof window.setInterval;
  const setTimeout = ((handler: TimerHandler) => {
    void handler;
    return 1;
  }) as typeof window.setTimeout;

  return {
    environment: {
      setInterval,
      clearInterval: vi.fn(),
      setTimeout,
      clearTimeout: vi.fn(),
    },
    runInterval() {
      intervalCallback?.();
    },
  };
}

function createReadyVideo() {
  const video = document.createElement("video");
  Object.defineProperty(video, "readyState", {
    configurable: true,
    value: 2,
  });
  Object.defineProperty(video, "videoWidth", {
    configurable: true,
    value: 640,
  });
  Object.defineProperty(video, "videoHeight", {
    configurable: true,
    value: 360,
  });
  return video;
}

function createBitmap(): ImageBitmap {
  return {
    close: vi.fn(),
    height: 16,
    width: 16,
  };
}

function createNow(values: readonly number[]) {
  let index = 0;
  return () => {
    const value = values[index] ?? values.at(-1) ?? 0;
    index += 1;
    return value;
  };
}

function syntheticVideoMetrics(droppedFrameCount: number): VideoMetrics {
  const aggregator = createVideoMetricsAggregator();
  aggregator.addObservation({
    frameId: 1,
    timestampOffsetMs: milliseconds(125),
    faceCount: 1,
    primaryFaceDetected: true,
    centred: true,
    framing: "workable",
    brightness: "balanced",
  });
  aggregator.addDroppedFrames(droppedFrameCount);
  return aggregator.finalize({ reason: "interrupted" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
