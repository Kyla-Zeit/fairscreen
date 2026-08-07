import { beforeEach, describe, expect, it } from "vitest";

import {
  RECORDING_MIME_CANDIDATES,
  startMediaRecorderSession,
  supportedMimeCandidates,
} from "./mediaRecorder";

describe("mediaRecorder", () => {
  beforeEach(() => {
    FakeRecorder.instances = [];
    FakeRecorder.supportedTypes = new Set<string>();
    FakeRecorder.rejectedTypes = new Set<string>();
    FakeRecorder.nextBlob = new Blob(["audio"], { type: "audio/webm" });
    FakeRecorder.failOnStop = false;
  });

  it("selects MIME candidates through feature detection in priority order", () => {
    FakeRecorder.supportedTypes = new Set([
      "audio/webm;codecs=opus",
      "video/webm",
    ]);

    expect(supportedMimeCandidates(FakeRecorder)).toEqual([
      "video/webm",
      "audio/webm;codecs=opus",
    ]);
  });

  it("falls back when a reported MIME candidate is rejected at construction", async () => {
    FakeRecorder.supportedTypes = new Set([
      "video/webm",
      "audio/webm;codecs=opus",
    ]);
    FakeRecorder.rejectedTypes = new Set(["video/webm"]);

    const started = startMediaRecorderSession({
      stream: fakeStream(),
      startedAtMs: 0,
      environment: {
        MediaRecorder: FakeRecorder,
        Blob,
      },
    });

    expect(started.ok).toBe(true);
    if (!started.ok) throw new Error("Recorder did not start.");
    expect(started.session.mimeType).toBe("audio/webm;codecs=opus");
    const stopped = await started.session.stop(1_250);
    expect(stopped.ok).toBe(true);
    if (!stopped.ok) throw new Error("Recorder did not stop.");
    expect(stopped.recording.sizeBytes).toBe(5);
    expect(stopped.recording.durationMs).toBe(1_250);
  });

  it("reports runtime recorder errors without fabricating a recording", async () => {
    FakeRecorder.supportedTypes = new Set(["audio/webm;codecs=opus"]);
    FakeRecorder.failOnStop = true;

    const started = startMediaRecorderSession({
      stream: fakeStream(),
      startedAtMs: 0,
      environment: {
        MediaRecorder: FakeRecorder,
        Blob,
      },
    });

    expect(started.ok).toBe(true);
    if (!started.ok) throw new Error("Recorder did not start.");
    await expect(started.session.stop(1_000)).resolves.toEqual({
      ok: false,
      code: "recorder-error",
    });
  });

  it("rejects zero-byte finalized recordings", async () => {
    FakeRecorder.supportedTypes = new Set(["audio/webm;codecs=opus"]);
    FakeRecorder.nextBlob = new Blob([], { type: "audio/webm" });

    const started = startMediaRecorderSession({
      stream: fakeStream(),
      startedAtMs: 0,
      environment: {
        MediaRecorder: FakeRecorder,
        Blob,
      },
    });

    expect(started.ok).toBe(true);
    if (!started.ok) throw new Error("Recorder did not start.");
    await expect(started.session.stop(1_000)).resolves.toEqual({
      ok: false,
      code: "zero-byte",
    });
  });

  it("reports unsupported when the constructor is absent", () => {
    const started = startMediaRecorderSession({
      stream: fakeStream(),
      startedAtMs: 0,
      environment: {
        Blob,
      },
    });

    expect(started).toEqual({ ok: false, code: "unsupported" });
  });

  it("keeps the candidate list pinned for browser matrix documentation", () => {
    expect(RECORDING_MIME_CANDIDATES).toEqual([
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
      "audio/webm;codecs=opus",
      "audio/mp4",
    ]);
  });
});

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static supportedTypes = new Set<string>();
  static rejectedTypes = new Set<string>();
  static nextBlob = new Blob(["audio"], { type: "audio/webm" });
  static failOnStop = false;

  readonly mimeType: string;
  state: RecordingState = "inactive";
  ondataavailable: ((event: { readonly data: Blob }) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    const mimeType = options?.mimeType ?? "audio/webm";
    if (FakeRecorder.rejectedTypes.has(mimeType)) {
      throw new DOMException("MIME rejected", "NotSupportedError");
    }
    this.mimeType = mimeType;
    FakeRecorder.instances.push(this);
  }

  static isTypeSupported(mimeType: string) {
    return FakeRecorder.supportedTypes.has(mimeType);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    if (FakeRecorder.failOnStop) {
      this.onerror?.(new Event("error"));
    } else {
      this.ondataavailable?.({ data: FakeRecorder.nextBlob });
    }
    this.onstop?.(new Event("stop"));
  }
}

function fakeStream() {
  return {
    getTracks: () => [],
  } as unknown as MediaStream;
}
