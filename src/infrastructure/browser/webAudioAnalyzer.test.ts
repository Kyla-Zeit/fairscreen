import { describe, expect, it } from "vitest";

import { startWebAudioMetricSession } from "./webAudioAnalyzer";

describe("webAudioAnalyzer", () => {
  it("resumes a suspended AudioContext once and finalizes aggregate metrics", async () => {
    const runtime = new FakeRuntime();
    let nowMs = 0;
    const started = await startWebAudioMetricSession({
      stream: fakeStream(),
      startedAtMs: 0,
      nowMs: () => nowMs,
      environment: runtime.environment,
    });

    expect(started.ok).toBe(true);
    expect(runtime.context?.resumeCount).toBe(1);
    if (!started.ok) throw new Error("Audio session did not start.");

    for (let index = 0; index < 120; index += 1) {
      nowMs += 50;
      runtime.tick();
    }

    const metrics = await started.session.stop(6_000);
    expect(metrics.sampleCount).toBe(120);
    expect(metrics.averageMicrophoneLevelDbfs.status).not.toBe("unavailable");
    expect(runtime.context?.closed).toBe(true);
    expect(JSON.stringify(metrics)).not.toMatch(/Float32Array|pcm|timeDomain/i);
  });

  it("falls back when a suspended AudioContext cannot resume", async () => {
    const runtime = new FakeRuntime({ resumeFails: true });
    const started = await startWebAudioMetricSession({
      stream: fakeStream(),
      startedAtMs: 0,
      nowMs: () => 0,
      environment: runtime.environment,
    });

    expect(started).toEqual({
      ok: false,
      reason: "initialization-failed",
    });
  });
});

class FakeRuntime {
  readonly environment;
  #callback: (() => void) | undefined;

  constructor(options: { readonly resumeFails?: boolean } = {}) {
    FakeAudioContext.latest = undefined;
    this.environment = {
      AudioContext: class extends FakeAudioContext {
        constructor() {
          super(options.resumeFails ?? false);
        }
      },
      setInterval: (callback: () => void) => {
        this.#callback = callback;
        return 1;
      },
      clearInterval: () => {
        this.#callback = undefined;
      },
    };
  }

  get context() {
    return FakeAudioContext.latest;
  }

  tick() {
    this.#callback?.();
  }
}

class FakeAudioContext {
  static latest: FakeAudioContext | undefined;

  state: AudioContextState = "suspended";
  resumeCount = 0;
  closed = false;
  readonly #resumeFails: boolean;

  constructor(resumeFails: boolean) {
    this.#resumeFails = resumeFails;
    FakeAudioContext.latest = this;
  }

  createMediaStreamSource() {
    return {
      connect: () => undefined,
      disconnect: () => undefined,
    };
  }

  createAnalyser() {
    return {
      fftSize: 2048,
      getFloatTimeDomainData: (array: Float32Array) => {
        array.fill(0.02);
      },
      disconnect: () => undefined,
    };
  }

  resume() {
    this.resumeCount += 1;
    if (!this.#resumeFails) {
      this.state = "running";
    }
    return Promise.resolve();
  }

  close() {
    this.closed = true;
    this.state = "closed";
    return Promise.resolve();
  }
}

function fakeStream() {
  return {
    getAudioTracks: () => [{ readyState: "live" }],
  } as unknown as MediaStream;
}
