import { describe, expect, it, vi } from "vitest";

import type { Clock } from "../../domain/ports";
import { isoDateTime } from "../../domain/factories";
import {
  capabilityStatusLabel,
  createBrowserCapabilityService,
  createUnknownCapabilityReport,
  type BrowserCapabilityEnvironment,
} from "./capabilities";

const fixedClock: Clock = {
  now: () => isoDateTime("2026-01-02T03:04:05.000Z"),
};

describe("browser capabilities", () => {
  it("starts with unknown statuses without turning them into unavailable", () => {
    const report = createUnknownCapabilityReport(fixedClock);

    expect(report.mediaDevices.status).toBe("unknown");
    expect(report.mediaRecorder.status).toBe("unknown");
    expect(report.mediaPipeFaceLandmarker.status).toBe("unknown");
    expect(
      report.recorderMimeTypes.every((mime) => !mime.reportedSupported),
    ).toBe(true);
    expect(capabilityStatusLabel("unknown")).toBe("Unknown");
  });

  it("runs a support report without requesting camera or microphone access", async () => {
    const getUserMedia = vi.fn();
    const enumerateDevices = vi.fn().mockResolvedValue([]);
    const environment: BrowserCapabilityEnvironment = {
      isSecureContext: true,
      mediaDevices: {
        enumerateDevices,
      },
      AudioContext: vi.fn(),
      MediaRecorder: {
        isTypeSupported: (mimeType) => mimeType === "video/webm",
      },
      Worker: vi.fn(),
      WebAssembly: {},
      indexedDB: {},
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 10, quota: 100 }),
      },
      Blob: vi.fn(),
      URL: {
        createObjectURL: () => "blob:test",
        revokeObjectURL: () => undefined,
      },
      print: () => undefined,
    };

    await expect(
      createBrowserCapabilityService(environment, fixedClock).getReport(),
    ).resolves.toMatchObject({
      capturedAt: "2026-01-02T03:04:05.000Z",
      secureContext: { status: "supported" },
      mediaDevices: { status: "supported" },
      mediaRecorder: { status: "supported" },
      storage: {
        indexedDb: { status: "supported" },
      },
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(enumerateDevices).toHaveBeenCalledTimes(1);
  });

  it("reports recorder MIME candidates independently", async () => {
    const environment: BrowserCapabilityEnvironment = {
      isSecureContext: true,
      MediaRecorder: {
        isTypeSupported: (mimeType) => mimeType === "audio/webm",
      },
    };

    const report = await createBrowserCapabilityService(
      environment,
      fixedClock,
    ).getReport();

    expect(report.recorderMimeTypes).toContainEqual({
      mimeType: "audio/webm",
      reportedSupported: true,
      trialResult: "not-run",
    });
    expect(report.recorderMimeTypes).toContainEqual({
      mimeType: "video/webm",
      reportedSupported: false,
      trialResult: "not-run",
    });
  });
});
