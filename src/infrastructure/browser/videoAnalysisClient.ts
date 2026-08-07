import type { AvailabilityReason } from "../../domain/common";
import type { VideoFrameObservation, VideoMetrics } from "../../domain/models";
import {
  createVideoMetricsAggregator,
  type VideoMetricsAggregator,
} from "../../features/video/aggregate";
import {
  FACE_LANDMARKER_MODEL_VERSION,
  VIDEO_METRIC_ALGORITHM_VERSION,
} from "../../features/video/conditions";
import {
  createDefaultVideoWorkerConfig,
  parseVideoWorkerResponse,
  type VideoWorkerErrorCode,
  type VideoWorkerResponse,
} from "../../features/video/videoWorkerProtocol";
import { publicAppConfig } from "../../app/config";

export type VideoAnalysisStatus =
  "starting" | "active" | "partial" | "unavailable" | "stopped";

export interface VideoAnalysisUpdate {
  readonly status: VideoAnalysisStatus;
  readonly processedFrameCount: number;
  readonly droppedFrameCount: number;
  readonly invalidFrameCount: number;
  readonly message: string;
}

export interface VideoAnalysisSession {
  readonly stop: (
    finishedAtMs: number,
    reason?: AvailabilityReason,
  ) => Promise<VideoMetrics>;
  readonly dispose: () => Promise<void>;
  readonly subscribe: (
    listener: (update: VideoAnalysisUpdate) => void,
  ) => () => void;
}

export type VideoAnalysisStartResult =
  | { readonly ok: true; readonly session: VideoAnalysisSession }
  | {
      readonly ok: false;
      readonly reason: AvailabilityReason;
      readonly message: string;
      readonly warning?: "model-load-failed" | "worker-unavailable";
    };

export interface VideoAnalysisInput {
  readonly videoElement: HTMLVideoElement;
  readonly startedAtMs: number;
  readonly nowMs: () => number;
  readonly targetSampleRateHz?: number | undefined;
  readonly environment?: VideoAnalysisEnvironment | undefined;
}

export interface VideoAnalysisEnvironment {
  readonly createWorker?: VideoAnalysisWorkerFactory | undefined;
  readonly createImageBitmap?: (
    source: HTMLVideoElement,
  ) => Promise<ImageBitmap>;
  readonly setInterval?: typeof window.setInterval | undefined;
  readonly clearInterval?: typeof window.clearInterval | undefined;
  readonly setTimeout?: typeof window.setTimeout | undefined;
  readonly clearTimeout?: typeof window.clearTimeout | undefined;
}

interface ActiveVideoAnalysisEnvironment {
  readonly createWorker: VideoAnalysisWorkerFactory;
  readonly createImageBitmap: (
    source: HTMLVideoElement,
  ) => Promise<ImageBitmap>;
  readonly setInterval: typeof window.setInterval;
  readonly clearInterval: typeof window.clearInterval;
  readonly setTimeout: typeof window.setTimeout;
  readonly clearTimeout: typeof window.clearTimeout;
}

export type VideoAnalysisWorkerFactory = () => VideoAnalysisWorkerLike;

export interface VideoAnalysisWorkerLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: unknown, transfer?: readonly Transferable[]): void;
  terminate(): void;
}

export async function startBrowserVideoAnalysisSession({
  environment = readVideoAnalysisEnvironment(),
  nowMs,
  startedAtMs,
  targetSampleRateHz = publicAppConfig.videoSampleFps,
  videoElement,
}: VideoAnalysisInput): Promise<VideoAnalysisStartResult> {
  if (!publicAppConfig.featureFlags.videoAnalysis) {
    return {
      ok: false,
      reason: "unsupported",
      message: "Local video analysis is disabled in this build.",
      warning: "worker-unavailable",
    };
  }

  const activeEnvironment = activateVideoAnalysisEnvironment(environment);
  if (!activeEnvironment) {
    return {
      ok: false,
      reason: "unsupported",
      message: "This browser cannot run local video analysis safely.",
      warning: "worker-unavailable",
    };
  }

  const worker = activeEnvironment.createWorker();
  const aggregator = createVideoMetricsAggregator({
    targetSampleRateHz,
    modelVersion: FACE_LANDMARKER_MODEL_VERSION,
  });

  try {
    await initializeWorker({
      environment: activeEnvironment,
      targetSampleRateHz,
      worker,
    });
  } catch {
    worker.terminate();
    return {
      ok: false,
      reason: "initialization-failed",
      message: "Local video analysis could not initialize.",
      warning: "model-load-failed",
    };
  }

  return {
    ok: true,
    session: createSession({
      aggregator,
      environment: activeEnvironment,
      nowMs,
      startedAtMs,
      targetSampleRateHz,
      videoElement,
      worker,
    }),
  };
}

function createSession({
  aggregator,
  environment,
  nowMs,
  startedAtMs,
  targetSampleRateHz,
  videoElement,
  worker,
}: {
  readonly aggregator: VideoMetricsAggregator;
  readonly environment: ActiveVideoAnalysisEnvironment;
  readonly nowMs: () => number;
  readonly startedAtMs: number;
  readonly targetSampleRateHz: number;
  readonly videoElement: HTMLVideoElement;
  readonly worker: VideoAnalysisWorkerLike;
}): VideoAnalysisSession {
  const subscribers = new Set<(update: VideoAnalysisUpdate) => void>();
  let disposed = false;
  let busy = false;
  let frameId = 0;
  let droppedFrameCount = 0;
  let invalidFrameCount = 0;
  let finalMetricsResolver:
    | ((message: Extract<VideoWorkerResponse, { type: "final" }>) => void)
    | undefined;

  const emit = (status: VideoAnalysisStatus, message: string) => {
    const update: VideoAnalysisUpdate = {
      status,
      processedFrameCount: aggregator.processedFrameCount,
      droppedFrameCount,
      invalidFrameCount,
      message,
    };
    for (const subscriber of subscribers) {
      subscriber(update);
    }
  };

  worker.onmessage = (event: MessageEvent<unknown>) => {
    let message: VideoWorkerResponse;
    try {
      message = parseVideoWorkerResponse(event.data);
    } catch {
      invalidFrameCount += 1;
      busy = false;
      emit("partial", "Video analysis ignored an unsafe worker message.");
      return;
    }

    switch (message.type) {
      case "observation":
        busy = false;
        aggregator.addObservation(message.value);
        emit("active", videoObservationMessage(message.value));
        return;
      case "final":
        finalMetricsResolver?.(message);
        finalMetricsResolver = undefined;
        return;
      case "error":
        busy = false;
        invalidFrameCount += 1;
        emit("partial", workerErrorMessage(message.code));
        return;
      case "disposed":
      case "ready":
        return;
    }
  };

  worker.onerror = () => {
    invalidFrameCount += 1;
    busy = false;
    emit("partial", "Video analysis worker failed; practice can continue.");
  };

  const intervalMs = Math.round(1_000 / targetSampleRateHz);
  const intervalId = environment.setInterval(() => {
    void sampleFrame();
  }, intervalMs);

  emit("active", "Video analysis active.");

  async function sampleFrame() {
    if (disposed) {
      return;
    }

    if (busy) {
      droppedFrameCount += 1;
      emit("partial", "Skipping video frames to keep controls responsive.");
      return;
    }

    if (!isVideoReady(videoElement)) {
      droppedFrameCount += 1;
      return;
    }

    busy = true;
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await environment.createImageBitmap(videoElement);
      const currentFrameId = frameId;
      frameId += 1;
      const timestampMs = nowMs();
      worker.postMessage(
        {
          type: "frame",
          frameId: currentFrameId,
          timestampMs,
          timestampOffsetMs: Math.max(0, timestampMs - startedAtMs),
          bitmap,
        },
        [bitmap],
      );
      bitmap = undefined;
    } catch {
      busy = false;
      invalidFrameCount += 1;
      bitmap?.close();
      emit("partial", "Video analysis skipped a frame.");
    }
  }

  return {
    subscribe(listener) {
      subscribers.add(listener);
      listener({
        status: "active",
        processedFrameCount: aggregator.processedFrameCount,
        droppedFrameCount,
        invalidFrameCount,
        message: "Video analysis active.",
      });
      return () => {
        subscribers.delete(listener);
      };
    },
    async stop(finishedAtMs, reason) {
      void finishedAtMs;
      disposed = true;
      environment.clearInterval(intervalId);
      let metrics: VideoMetrics;
      try {
        metrics = await waitForWorkerFinal({
          environment,
          invalidFrameCount,
          droppedFrameCount,
          setResolver: (resolver) => {
            finalMetricsResolver = resolver;
          },
          worker,
        });
      } catch {
        aggregator.addDroppedFrames(droppedFrameCount);
        for (let index = 0; index < invalidFrameCount; index += 1) {
          aggregator.addInvalidFrame();
        }
        metrics = aggregator.finalize({
          reason: reason ?? "interrupted",
          warning: "worker-unavailable",
        });
      } finally {
        worker.postMessage({ type: "dispose" });
        worker.terminate();
      }

      emit("stopped", "Video analysis stopped.");
      return metrics;
    },
    dispose() {
      disposed = true;
      environment.clearInterval(intervalId);
      worker.postMessage({ type: "dispose" });
      worker.terminate();
      emit("stopped", "Video analysis stopped.");
      return Promise.resolve();
    },
  };
}

async function initializeWorker({
  environment,
  targetSampleRateHz,
  worker,
}: {
  readonly environment: ActiveVideoAnalysisEnvironment;
  readonly targetSampleRateHz: number;
  readonly worker: VideoAnalysisWorkerLike;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = environment.setTimeout(() => {
      cleanup();
      reject(new Error("video-worker-init-timeout"));
    }, 10_000);

    const cleanup = () => {
      environment.clearTimeout(timeout);
      worker.onmessage = null;
      worker.onerror = null;
    };

    worker.onmessage = (event: MessageEvent<unknown>) => {
      try {
        const message = parseVideoWorkerResponse(event.data);
        if (message.type === "ready") {
          cleanup();
          resolve();
          return;
        }
        if (message.type === "error") {
          cleanup();
          reject(new Error(message.code));
        }
      } catch (error) {
        cleanup();
        reject(
          error instanceof Error ? error : new Error("video-worker-init-error"),
        );
      }
    };
    worker.onerror = (event) => {
      void event;
      cleanup();
      reject(new Error("video-worker-error"));
    };

    worker.postMessage({
      type: "init",
      config: createDefaultVideoWorkerConfig({
        algorithmVersion: VIDEO_METRIC_ALGORITHM_VERSION,
        enableBacklightingLabel: false,
        modelAssetPath: publicAppConfig.modelPath,
        modelVersion: FACE_LANDMARKER_MODEL_VERSION,
        targetSampleRateHz,
        wasmRootPath: publicAppConfig.wasmRootPath,
      }),
    });
  });
}

async function waitForWorkerFinal({
  droppedFrameCount,
  environment,
  invalidFrameCount,
  setResolver,
  worker,
}: {
  readonly worker: VideoAnalysisWorkerLike;
  readonly environment: ActiveVideoAnalysisEnvironment;
  readonly droppedFrameCount: number;
  readonly invalidFrameCount: number;
  readonly setResolver: (
    resolver: (
      message: Extract<VideoWorkerResponse, { type: "final" }>,
    ) => void,
  ) => void;
}): Promise<VideoMetrics> {
  return new Promise((resolve, reject) => {
    const timeout = environment.setTimeout(() => {
      reject(new Error("video-worker-final-timeout"));
    }, 1_000);

    setResolver((message) => {
      environment.clearTimeout(timeout);
      resolve(message.metrics);
    });

    try {
      worker.postMessage({
        type: "finalize",
        droppedFrameCount,
        invalidFrameCount,
      });
    } catch (error) {
      environment.clearTimeout(timeout);
      reject(
        error instanceof Error
          ? error
          : new Error("video-worker-finalize-error"),
      );
    }
  });
}

function isVideoReady(video: HTMLVideoElement): boolean {
  return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
}

function videoObservationMessage(observation: VideoFrameObservation): string {
  if (!observation.primaryFaceDetected) {
    return "Video analysis active; no face-like shape detected in the latest sample.";
  }

  return observation.faceCount === 2
    ? "Video analysis active; more than one face-like shape was detected in the latest sample."
    : "Video analysis active.";
}

function workerErrorMessage(code: VideoWorkerErrorCode): string {
  switch (code) {
    case "model-load-failed":
      return "Local video analysis could not load.";
    case "inference-failed":
      return "Local video analysis skipped a frame.";
    case "unsupported-frame-transfer":
      return "This browser cannot transfer video frames safely.";
    case "worker-disposed":
      return "Video analysis stopped.";
    case "invalid-message":
      return "Video analysis ignored an invalid worker message.";
  }
}

function activateVideoAnalysisEnvironment(
  environment: VideoAnalysisEnvironment,
): ActiveVideoAnalysisEnvironment | undefined {
  if (!environment.createWorker || !environment.createImageBitmap) {
    return undefined;
  }

  return {
    createWorker: environment.createWorker,
    createImageBitmap: environment.createImageBitmap,
    setInterval: environment.setInterval ?? window.setInterval.bind(window),
    clearInterval:
      environment.clearInterval ?? window.clearInterval.bind(window),
    setTimeout: environment.setTimeout ?? window.setTimeout.bind(window),
    clearTimeout: environment.clearTimeout ?? window.clearTimeout.bind(window),
  };
}

function readVideoAnalysisEnvironment(): VideoAnalysisEnvironment {
  return {
    createWorker:
      typeof Worker === "undefined" ? undefined : createVideoAnalysisWorker,
    createImageBitmap: globalThis.createImageBitmap,
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
  };
}

function createVideoAnalysisWorker(): VideoAnalysisWorkerLike {
  return new Worker(
    new URL("../../features/video/videoAnalysis.worker.ts", import.meta.url),
  );
}
