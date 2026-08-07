import type { AvailabilityReason } from "../../domain/common";
import {
  buildAudioMetrics,
  createAudioWindowObservation,
  type AudioWindowObservation,
} from "../../features/audio/audioMetrics";
import type { AudioMetrics } from "../../domain/models";

interface MediaStreamAudioSourceNodeLike {
  connect(node: AnalyserNodeLike): void;
  disconnect(): void;
}

interface AnalyserNodeLike {
  fftSize: number;
  getFloatTimeDomainData(array: Float32Array): void;
  disconnect(): void;
}

interface AudioContextLike {
  readonly state: AudioContextState;
  createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNodeLike;
  createAnalyser(): AnalyserNodeLike;
  resume(): Promise<void>;
  close(): Promise<void>;
}

type AudioContextConstructorLike = new () => AudioContextLike;

export interface WebAudioAnalyzerEnvironment {
  readonly AudioContext?: AudioContextConstructorLike | undefined;
  readonly webkitAudioContext?: AudioContextConstructorLike | undefined;
  readonly setInterval: (handler: () => void, timeoutMs: number) => number;
  readonly clearInterval: (id: number) => void;
}

export interface WebAudioAnalyzerInput {
  readonly stream: MediaStream;
  readonly startedAtMs: number;
  readonly nowMs: () => number;
  readonly environment?: WebAudioAnalyzerEnvironment;
}

export type WebAudioAnalyzerStartResult =
  | { readonly ok: true; readonly session: WebAudioMetricSession }
  | {
      readonly ok: false;
      readonly reason: Extract<
        AvailabilityReason,
        "unsupported" | "initialization-failed"
      >;
    };

export interface WebAudioMetricSession {
  readonly stop: (
    finishedAtMs: number,
    reason?: AvailabilityReason,
  ) => Promise<AudioMetrics>;
  readonly dispose: () => Promise<void>;
}

export async function startWebAudioMetricSession({
  environment = readWebAudioAnalyzerEnvironment(),
  nowMs,
  startedAtMs,
  stream,
}: WebAudioAnalyzerInput): Promise<WebAudioAnalyzerStartResult> {
  const Constructor =
    environment.AudioContext ?? environment.webkitAudioContext;
  if (!Constructor) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    const audioContext = new Constructor();
    if (readAudioContextState(audioContext) === "suspended") {
      await audioContext.resume();
      if (readAudioContextState(audioContext) === "suspended") {
        await audioContext.close().catch(() => undefined);
        return { ok: false, reason: "initialization-failed" };
      }
    }

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const samples = new Float32Array(analyser.fftSize);
    const observations: AudioWindowObservation[] = [];
    let disposed = false;

    const intervalId = environment.setInterval(() => {
      const audioTrackLive = stream
        .getAudioTracks()
        .some((track) => track.readyState === "live");
      analyser.getFloatTimeDomainData(samples);
      const result = createAudioWindowObservation(
        samples,
        nowMs() - startedAtMs,
        audioTrackLive,
      );
      if (result.ok && result.observation) {
        observations.push(result.observation);
      } else {
        observations.push({
          offsetMs: Math.max(0, Math.round(nowMs() - startedAtMs)),
          rms: Number.NaN,
          trackLive: audioTrackLive,
        });
      }
    }, 50);

    async function dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      environment.clearInterval(intervalId);
      source.disconnect();
      analyser.disconnect();
      await audioContext.close().catch(() => undefined);
    }

    return {
      ok: true,
      session: {
        async stop(finishedAtMs, reason) {
          await dispose();
          return buildAudioMetrics({
            startedAtMs,
            finishedAtMs,
            captureRequested: true,
            windows: observations,
            ...(reason ? { interruptionReason: reason } : {}),
          });
        },
        dispose,
      },
    };
  } catch {
    return { ok: false, reason: "initialization-failed" };
  }
}

function readWebAudioAnalyzerEnvironment(): WebAudioAnalyzerEnvironment {
  const windowLike = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

  return {
    AudioContext: windowLike.AudioContext as unknown as
      AudioContextConstructorLike | undefined,
    webkitAudioContext: windowLike.webkitAudioContext as unknown as
      AudioContextConstructorLike | undefined,
    setInterval: (handler, timeoutMs) => window.setInterval(handler, timeoutMs),
    clearInterval: (id) => {
      window.clearInterval(id);
    },
  };
}

function readAudioContextState(
  audioContext: AudioContextLike,
): AudioContextState {
  return audioContext.state;
}
