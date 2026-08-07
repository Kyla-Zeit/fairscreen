import { describe, expect, it } from "vitest";

import { degrees, milliseconds } from "../../domain/factories";
import type { VideoFrameObservation } from "../../domain/models";
import {
  createUnavailableVideoMetrics,
  createVideoMetricsAggregator,
} from "./aggregate";
import { VIDEO_METRIC_ALGORITHM_VERSION } from "./conditions";

describe("video metrics aggregation", () => {
  it("produces complete approved aggregates from sufficient observations", () => {
    const aggregator = createVideoMetricsAggregator();
    for (let index = 0; index < 24; index += 1) {
      aggregator.addObservation(observation(index));
    }

    const metrics = aggregator.finalize();

    expect(metrics.algorithmVersion).toBe(VIDEO_METRIC_ALGORITHM_VERSION);
    expect(metrics.status).toBe("complete");
    expect(metrics.processedFrameCount).toBe(24);
    expect(metrics.faceDetectionPercentage).toMatchObject({
      status: "available",
      calculationQuality: "adequate",
    });
    expect(metrics.faceDetectionPercentage.status).toBe("available");
    if (metrics.faceDetectionPercentage.status !== "available") {
      throw new Error("face-detection-metric-unavailable");
    }
    expect(metrics.faceDetectionPercentage.value).toBe(100);
    expect(metrics.framing.status).toBe("available");
    if (metrics.framing.status !== "available") {
      throw new Error("framing-metric-unavailable");
    }
    expect(metrics.framing.value.dominant).toBe("workable");
    expect(JSON.stringify(metrics)).not.toMatch(
      /frameData|faceLandmarks|landmarks|blendshapes|pixels|facialTransformationMatrixes|embedding/i,
    );
  });

  it("marks low-sample or dropped-frame metrics as partial with warnings", () => {
    const aggregator = createVideoMetricsAggregator();
    for (let index = 0; index < 4; index += 1) {
      aggregator.addObservation(observation(index));
    }
    aggregator.addDroppedFrames(6);

    const metrics = aggregator.finalize({ reason: "interrupted" });

    expect(metrics.status).toBe("partial");
    expect(metrics.droppedFrameCount).toBe(6);
    expect(metrics.warnings).toEqual(
      expect.arrayContaining([
        "low-sample-count",
        "many-dropped-frames",
        "partial-samples",
      ]),
    );
    expect(metrics.faceDetectionPercentage.status).toBe("unavailable");
    expect(metrics.brightness.status).toBe("partial");
  });

  it("creates unavailable metrics for skipped or failed video analysis", () => {
    const metrics = createUnavailableVideoMetrics(
      "initialization-failed",
      8,
      "model-load-failed",
    );

    expect(metrics.status).toBe("unavailable");
    expect(metrics.processedFrameCount).toBe(0);
    expect(metrics.faceDetectionPercentage).toMatchObject({
      status: "unavailable",
      reason: "initialization-failed",
    });
    expect(metrics.warnings).toEqual(
      expect.arrayContaining(["model-load-failed", "worker-unavailable"]),
    );
  });
});

function observation(frameId: number): VideoFrameObservation {
  return {
    frameId,
    timestampOffsetMs: milliseconds(frameId * 125),
    faceCount: 1,
    primaryFaceDetected: true,
    centred: true,
    nearCameraOrientation: true,
    yawDeltaDegrees: degrees(0),
    pitchDeltaDegrees: degrees(0),
    framing: "workable",
    brightness: "balanced",
  };
}
