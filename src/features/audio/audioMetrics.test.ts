import { describe, expect, it } from "vitest";

import { decibelsFullScale, milliseconds } from "../../domain/factories";
import type { AudioCalibration } from "../../domain/models";
import {
  AUDIO_METRIC_ALGORITHM_VERSION,
  AUDIO_SAMPLE_INTERVAL_MS,
  buildAudioMetrics,
  calculateRms,
  calibrateAudio,
  detectSpeechSegments,
  rmsToDbfs,
  type AudioWindowObservation,
} from "./audioMetrics";

describe("audioMetrics", () => {
  it("matches hand-calculated RMS and dBFS fixtures", () => {
    expect(calculateRms([1, -1, 1, -1])).toBe(1);
    expect(Number(rmsToDbfs(1))).toBeCloseTo(0, 5);
    expect(calculateRms([0.5, -0.5])).toBe(0.5);
    expect(Number(rmsToDbfs(0.5))).toBeCloseTo(-6.0206, 4);
    expect(Number(rmsToDbfs(0))).toBe(-100);
    expect(calculateRms([0, Number.NaN])).toBeUndefined();
  });

  it("calibrates median noise floor, threshold clamp, and noisy quality", () => {
    const quiet = calibrateAudio([
      windowAt(0, -70),
      windowAt(50, -60),
      windowAt(100, -50),
    ]);
    expect(quiet.noiseFloorDbfs).toBe(decibelsFullScale(-60));
    expect(quiet.speechThresholdDbfs).toBe(decibelsFullScale(-50));
    expect(quiet.calibrationQuality).toBe("adequate");

    const noisy = calibrateAudio([
      windowAt(0, -30),
      windowAt(50, -29),
      windowAt(100, -28),
    ]);
    expect(noisy.speechThresholdDbfs).toBe(decibelsFullScale(-25));
    expect(noisy.calibrationQuality).toBe("noisy");

    const clipped = calibrateAudio([
      windowAt(0, -0.5),
      windowAt(50, -0.5),
      windowAt(100, -0.5),
      windowAt(150, -0.5),
      windowAt(200, -20),
    ]);
    expect(clipped.calibrationQuality).toBe("invalid");
  });

  it("uses strict above-threshold attack and release hysteresis", () => {
    const calibration = calibrationAtThreshold(-40);
    const observations = [
      windowAt(0, -40),
      windowAt(50, -39),
      windowAt(100, -39),
      windowAt(150, -39),
      windowAt(200, -39),
      windowAt(250, -39),
      windowAt(300, -42),
      windowAt(350, -42),
      windowAt(400, -42),
      windowAt(450, -42),
      windowAt(500, -42),
    ];

    expect(detectSpeechSegments(observations, calibration)).toEqual([
      {
        startOffsetMs: milliseconds(50),
        endOffsetMs: milliseconds(300),
      },
    ]);
  });

  it("merges adjacent speech segments separated by less than 300 ms", () => {
    const calibration = calibrationAtThreshold(-40);
    const observations = [
      ...speechBurst(0, 6),
      ...silence(300, 5),
      ...speechBurst(550, 6),
      ...silence(850, 5),
    ];

    expect(detectSpeechSegments(observations, calibration)).toEqual([
      {
        startOffsetMs: milliseconds(0),
        endOffsetMs: milliseconds(850),
      },
    ]);
  });

  it("marks zero samples as unavailable rather than a zero metric", () => {
    const metrics = buildAudioMetrics({
      startedAtMs: 0,
      finishedAtMs: 6_000,
      captureRequested: true,
      windows: Array.from({ length: 120 }, (_, index) => ({
        offsetMs: index * AUDIO_SAMPLE_INTERVAL_MS,
        rms: 0,
        trackLive: true,
      })),
    });

    expect(metrics.status).toBe("unavailable");
    expect(metrics.averageMicrophoneLevelDbfs.status).toBe("unavailable");
    expect(metrics.averageMicrophoneLevelDbfs).not.toHaveProperty("value", 0);
    expect(metrics.warnings).toContain("all-zero-signal");
  });

  it("creates partial metrics for interrupted captures without losing timer duration", () => {
    const metrics = buildAudioMetrics({
      startedAtMs: 0,
      finishedAtMs: 6_000,
      captureRequested: true,
      interruptionReason: "interrupted",
      windows: [
        ...Array.from({ length: 20 }, (_, index) =>
          windowAt(index * AUDIO_SAMPLE_INTERVAL_MS, -65),
        ),
        ...speechBurst(1_000, 100),
      ],
    });

    expect(metrics.status).toBe("partial");
    expect(metrics.answerDurationMs.status).toBe("partial");
    expect(
      metrics.answerDurationMs.status === "partial" &&
        metrics.answerDurationMs.value,
    ).toBe(milliseconds(6_000));
    expect(metrics.warnings).toContain("tab-or-device-suspended");
  });

  it("keeps WPM unavailable until transcript and speech-time prerequisites exist", () => {
    const withoutTranscript = buildAudioMetrics({
      startedAtMs: 0,
      finishedAtMs: 6_000,
      captureRequested: true,
      windows: [
        ...Array.from({ length: 20 }, (_, index) =>
          windowAt(index * AUDIO_SAMPLE_INTERVAL_MS, -65),
        ),
        ...speechBurst(1_000, 120),
      ],
    });
    expect(withoutTranscript.approximateWordsPerMinute.status).toBe(
      "unavailable",
    );

    const withTranscript = buildAudioMetrics({
      startedAtMs: 0,
      finishedAtMs: 8_000,
      captureRequested: true,
      transcriptWordCount: 20,
      windows: [
        ...Array.from({ length: 20 }, (_, index) =>
          windowAt(index * AUDIO_SAMPLE_INTERVAL_MS, -65),
        ),
        ...speechBurst(1_000, 120),
      ],
    });
    expect(withTranscript.approximateWordsPerMinute.status).toBe("available");
    expect(
      withTranscript.approximateWordsPerMinute.status === "available" &&
        withTranscript.approximateWordsPerMinute.value,
    ).toBeCloseTo(200, 1);
  });

  it("does not serialize raw audio arrays or PCM-like fields", () => {
    const metrics = buildAudioMetrics({
      startedAtMs: 0,
      finishedAtMs: 6_000,
      captureRequested: true,
      windows: [
        ...Array.from({ length: 20 }, (_, index) =>
          windowAt(index * AUDIO_SAMPLE_INTERVAL_MS, -65),
        ),
        ...speechBurst(1_000, 120),
      ],
    });

    expect(metrics.algorithmVersion).toBe(AUDIO_METRIC_ALGORITHM_VERSION);
    expect(JSON.stringify(metrics)).not.toMatch(
      /pcm|Float32Array|timeDomain|rms/i,
    );
  });
});

function windowAt(offsetMs: number, dbfs: number): AudioWindowObservation {
  return {
    offsetMs,
    rms: 10 ** (dbfs / 20),
    trackLive: true,
  };
}

function speechBurst(
  startOffsetMs: number,
  count: number,
): readonly AudioWindowObservation[] {
  return Array.from({ length: count }, (_, index) =>
    windowAt(startOffsetMs + index * AUDIO_SAMPLE_INTERVAL_MS, -30),
  );
}

function silence(
  startOffsetMs: number,
  count: number,
): readonly AudioWindowObservation[] {
  return Array.from({ length: count }, (_, index) =>
    windowAt(startOffsetMs + index * AUDIO_SAMPLE_INTERVAL_MS, -60),
  );
}

function calibrationAtThreshold(thresholdDbfs: number): AudioCalibration {
  return {
    sampleCount: 20,
    noiseFloorDbfs: decibelsFullScale(thresholdDbfs - 10),
    speechThresholdDbfs: decibelsFullScale(thresholdDbfs),
    attackMs: milliseconds(150),
    releaseMs: milliseconds(250),
    calibrationQuality: "adequate",
  };
}
