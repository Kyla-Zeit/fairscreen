import { describe, expect, it, vi } from "vitest";

import {
  createBrowserMediaDeviceService,
  normalizeMediaError,
  stopMediaStream,
  type BrowserMediaEnvironment,
} from "./mediaDevices";

describe("browser media device service", () => {
  it("enumerates default options before labels are available", async () => {
    const environment: BrowserMediaEnvironment = {
      isSecureContext: true,
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia: vi.fn(),
      },
    };

    await expect(
      createBrowserMediaDeviceService(environment).enumerateDevices(),
    ).resolves.toEqual([
      {
        deviceId: "default",
        isDefault: true,
        kind: "camera",
        label: "Default camera",
      },
      {
        deviceId: "default",
        isDefault: true,
        kind: "microphone",
        label: "Default microphone",
      },
    ]);
  });

  it("requests camera and refreshes labels after permission", async () => {
    const stream = createFakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const enumerateDevices = vi
      .fn()
      .mockResolvedValue([
        createDevice("videoinput", "camera-1", "Front camera"),
        createDevice("audioinput", "mic-1", "Desk microphone"),
      ]);
    const environment: BrowserMediaEnvironment = {
      isSecureContext: true,
      mediaDevices: {
        enumerateDevices,
        getUserMedia,
      },
    };

    const result =
      await createBrowserMediaDeviceService(environment).requestCamera();

    expect(result).toMatchObject({
      ok: true,
      devices: [
        {
          deviceId: "camera-1",
          kind: "camera",
          label: "Front camera",
        },
        {
          deviceId: "mic-1",
          kind: "microphone",
          label: "Desk microphone",
        },
      ],
    });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: false, video: true });
  });

  it("stops all tracks when a stream is replaced or cleared", () => {
    const firstStop = vi.fn();
    const secondStop = vi.fn();
    const stream = {
      getTracks: () => [{ stop: firstStop }, { stop: secondStop }],
    } as unknown as MediaStream;

    stopMediaStream(stream);

    expect(firstStop).toHaveBeenCalledTimes(1);
    expect(secondStop).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["NotAllowedError", "permission-denied"],
    ["NotFoundError", "device-not-found"],
    ["NotReadableError", "device-unreadable"],
    ["OverconstrainedError", "constraints-unsatisfied"],
    ["SecurityError", "policy-blocked"],
    ["AbortError", "request-aborted"],
    ["TypeError", "insecure-context"],
  ])("normalizes %s", (name, code) => {
    expect(normalizeMediaError({ name })).toMatchObject({ code });
  });
});

function createFakeStream() {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
  return {
    getTracks: () => tracks,
  } as unknown as MediaStream;
}

function createDevice(
  kind: MediaDeviceInfo["kind"],
  deviceId: string,
  label: string,
): MediaDeviceInfo {
  return {
    deviceId,
    groupId: "",
    kind,
    label,
    toJSON: () => ({}),
  };
}
