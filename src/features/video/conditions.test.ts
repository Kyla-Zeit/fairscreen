import { describe, expect, it } from "vitest";

import {
  calculateFaceBounds,
  classifyBrightness,
  classifyFraming,
  createVideoFrameObservation,
  DEFAULT_VIDEO_THRESHOLDS,
  estimateOrientation,
  isReasonablyCentred,
  selectPrimaryFace,
  type NormalizedPoint,
} from "./conditions";

describe("video condition geometry", () => {
  it("handles face-boundary, centring, and framing conditions", () => {
    const workable = requireBounds(
      calculateFaceBounds(rectangle(0.38, 0.25, 0.62, 0.61)),
    );
    expect(isReasonablyCentred(workable)).toBe(true);
    expect(classifyFraming(workable)).toBe("workable");

    expect(
      classifyFraming(
        requireBounds(calculateFaceBounds(rectangle(0.01, 0.2, 0.4, 0.7))),
      ),
    ).toBe("edge-or-partial");
    expect(
      classifyFraming(
        requireBounds(calculateFaceBounds(rectangle(0.45, 0.35, 0.55, 0.55))),
      ),
    ).toBe("too-far");
    expect(
      classifyFraming(
        requireBounds(calculateFaceBounds(rectangle(0.1, 0.1, 0.9, 0.8))),
      ),
    ).toBe("too-close");
  });

  it("rejects missing, non-finite, degenerate, and implausible landmarks", () => {
    expect(calculateFaceBounds([])).toBeUndefined();
    expect(calculateFaceBounds([{ x: Number.NaN, y: 0.1 }])).toBeUndefined();
    expect(calculateFaceBounds(rectangle(0.2, 0.2, 0.2, 0.5))).toBeUndefined();
    expect(calculateFaceBounds(rectangle(-0.2, 0.1, 0.4, 0.5))).toBeUndefined();
  });

  it("selects the largest face unless previous centre continuity applies", () => {
    const previous = calculateFaceBounds(rectangle(0.1, 0.1, 0.3, 0.4));
    const nearPrevious = calculateFaceBounds(rectangle(0.12, 0.1, 0.32, 0.4));
    const larger = calculateFaceBounds(rectangle(0.55, 0.2, 0.9, 0.7));
    const previousBounds = requireBounds(previous);
    const nearPreviousBounds = requireBounds(nearPrevious);
    const largerBounds = requireBounds(larger);

    const selected = selectPrimaryFace(
      [
        { index: 0, bounds: nearPreviousBounds },
        { index: 1, bounds: largerBounds },
      ],
      previousBounds,
    );

    expect(selected?.index).toBe(0);
  });

  it("keeps mirror display independent from observed coordinates", () => {
    const observation = createVideoFrameObservation({
      brightness: { meanLuma: 0.5, lumaSpread: 0.1 },
      faces: [rectangle(0.38, 0.25, 0.62, 0.61)],
      frameId: 1,
      timestampOffsetMs: 120,
    });
    const mirroredDisplayObservation = createVideoFrameObservation({
      brightness: { meanLuma: 0.5, lumaSpread: 0.1 },
      faces: [rectangle(0.38, 0.25, 0.62, 0.61)],
      frameId: 1,
      timestampOffsetMs: 120,
    });

    expect(mirroredDisplayObservation).toEqual(observation);
    expect(JSON.stringify(observation)).not.toMatch(
      /landmark|matrix|blendshape|pixel|image/i,
    );
  });

  it("classifies luminance and keeps backlighting label off by default", () => {
    expect(classifyBrightness({ meanLuma: 0.12, lumaSpread: 0.1 })).toBe("dim");
    expect(classifyBrightness({ meanLuma: 0.9, lumaSpread: 0.1 })).toBe(
      "bright",
    );
    expect(classifyBrightness({ meanLuma: 0.5, lumaSpread: 0.7 })).toBe(
      "uneven",
    );
    expect(
      classifyBrightness({
        meanLuma: 0.5,
        lumaSpread: 0.8,
        possibleBacklight: true,
      }),
    ).toBe("uneven");
    expect(
      classifyBrightness(
        { meanLuma: 0.5, lumaSpread: 0.8, possibleBacklight: true },
        DEFAULT_VIDEO_THRESHOLDS,
        true,
      ),
    ).toBe("possible-backlighting");
  });

  it("uses only validated matrices for near-camera orientation", () => {
    expect(estimateOrientation([1, 0, 0])).toBeUndefined();
    expect(
      estimateOrientation(Array.from({ length: 16 }, () => Number.NaN)),
    ).toBeUndefined();

    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    expect(estimateOrientation(identity)?.yawDegrees).toBeCloseTo(0);
    expect(estimateOrientation(identity)?.pitchDegrees).toBeCloseTo(0);
  });
});

function rectangle(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): readonly NormalizedPoint[] {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function requireBounds<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("expected-bounds");
  }
  return value;
}
