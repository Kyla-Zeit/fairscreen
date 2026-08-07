import type { ByteCount, Milliseconds } from "../../domain/common";
import { byteCount, milliseconds } from "../../domain/factories";

export const RECORDING_MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
  "audio/webm;codecs=opus",
  "audio/mp4",
] as const;

export type RecorderFailureCode =
  "unsupported" | "mime-rejected" | "recorder-error" | "zero-byte";

export interface CapturedRecording {
  readonly blob: Blob;
  readonly mimeType: string;
  readonly sizeBytes: ByteCount;
  readonly durationMs: Milliseconds;
}

interface BlobEventLike {
  readonly data: Blob;
}

interface MediaRecorderLike {
  readonly mimeType: string;
  readonly state: RecordingState;
  ondataavailable: ((event: BlobEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onstop: ((event: Event) => void) | null;
  start(timeslice?: number): void;
  stop(): void;
}

interface MediaRecorderConstructorLike {
  new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorderLike;
  isTypeSupported?: (mimeType: string) => boolean;
}

export interface MediaRecorderEnvironment {
  readonly MediaRecorder?: MediaRecorderConstructorLike | undefined;
  readonly Blob: typeof Blob;
}

export interface MediaRecorderSession {
  readonly mimeType: string;
  readonly stop: (finishedAtMs: number) => Promise<RecordingStopResult>;
  readonly discard: () => Promise<void>;
}

export type MediaRecorderStartResult =
  | { readonly ok: true; readonly session: MediaRecorderSession }
  | { readonly ok: false; readonly code: RecorderFailureCode };

export type RecordingStopResult =
  | { readonly ok: true; readonly recording: CapturedRecording }
  | { readonly ok: false; readonly code: RecorderFailureCode };

export function startMediaRecorderSession({
  environment = readMediaRecorderEnvironment(),
  startedAtMs,
  stream,
  timesliceMs = 1_000,
}: {
  readonly stream: MediaStream;
  readonly startedAtMs: number;
  readonly environment?: MediaRecorderEnvironment;
  readonly timesliceMs?: number;
}): MediaRecorderStartResult {
  const Constructor = environment.MediaRecorder;
  if (!Constructor) {
    return { ok: false, code: "unsupported" };
  }

  const explicitCandidates = supportedMimeCandidates(Constructor);
  const attempts: readonly (string | undefined)[] = [
    ...explicitCandidates,
    undefined,
  ];
  let explicitCandidateRejected = false;

  for (const candidate of attempts) {
    try {
      const recorder = new Constructor(
        stream,
        candidate ? { mimeType: candidate } : undefined,
      );
      const chunks: Blob[] = [];
      let runtimeFailure: RecorderFailureCode | undefined;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = () => {
        runtimeFailure = "recorder-error";
      };
      recorder.start(timesliceMs);

      return {
        ok: true,
        session: createSession({
          chunks,
          environment,
          recorder,
          startedAtMs,
          runtimeFailure: () => runtimeFailure,
        }),
      };
    } catch {
      if (candidate) {
        explicitCandidateRejected = true;
      }
    }
  }

  return {
    ok: false,
    code: explicitCandidateRejected ? "mime-rejected" : "unsupported",
  };
}

export function supportedMimeCandidates(
  Constructor: MediaRecorderConstructorLike,
): readonly string[] {
  if (!Constructor.isTypeSupported) {
    return [];
  }

  return RECORDING_MIME_CANDIDATES.filter((candidate) =>
    Constructor.isTypeSupported?.(candidate),
  );
}

function createSession({
  chunks,
  environment,
  recorder,
  runtimeFailure,
  startedAtMs,
}: {
  readonly chunks: Blob[];
  readonly environment: MediaRecorderEnvironment;
  readonly recorder: MediaRecorderLike;
  readonly runtimeFailure: () => RecorderFailureCode | undefined;
  readonly startedAtMs: number;
}): MediaRecorderSession {
  let stopped = false;
  let stopPromise: Promise<RecordingStopResult> | undefined;

  function finalize(finishedAtMs: number): RecordingStopResult {
    const failure = runtimeFailure();
    if (failure) {
      return { ok: false, code: failure };
    }

    const chunkMimeType = chunks[0]?.type;
    const mimeType =
      recorder.mimeType.length > 0
        ? recorder.mimeType
        : chunkMimeType && chunkMimeType.length > 0
          ? chunkMimeType
          : "application/octet-stream";
    const blob = new environment.Blob(chunks, { type: mimeType });
    if (blob.size === 0) {
      return { ok: false, code: "zero-byte" };
    }

    return {
      ok: true,
      recording: {
        blob,
        mimeType,
        sizeBytes: byteCount(blob.size),
        durationMs: milliseconds(
          Math.max(0, Math.round(finishedAtMs - startedAtMs)),
        ),
      },
    };
  }

  return {
    mimeType: recorder.mimeType,
    stop(finishedAtMs) {
      if (stopPromise) {
        return stopPromise;
      }

      stopPromise = new Promise<RecordingStopResult>((resolve) => {
        const finish = () => {
          resolve(finalize(finishedAtMs));
        };

        recorder.onstop = finish;
        if (recorder.state === "inactive" || stopped) {
          finish();
          return;
        }

        try {
          stopped = true;
          recorder.stop();
        } catch {
          resolve({ ok: false, code: "recorder-error" });
        }
      });

      return stopPromise;
    },
    async discard() {
      if (recorder.state === "inactive" || stopped) {
        chunks.splice(0);
        return;
      }

      await new Promise<void>((resolve) => {
        recorder.onstop = () => {
          chunks.splice(0);
          resolve();
        };
        try {
          stopped = true;
          recorder.stop();
        } catch {
          chunks.splice(0);
          resolve();
        }
      });
    },
  };
}

function readMediaRecorderEnvironment(): MediaRecorderEnvironment {
  const globalWithRecorder = globalThis as typeof globalThis & {
    MediaRecorder?: typeof MediaRecorder;
  };

  return {
    MediaRecorder: globalWithRecorder.MediaRecorder as
      MediaRecorderConstructorLike | undefined,
    Blob,
  };
}
