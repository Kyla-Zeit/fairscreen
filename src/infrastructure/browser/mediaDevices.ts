export type MediaKind = "camera" | "microphone";

export type MediaAccessErrorCode =
  | "permission-denied"
  | "permission-dismissed-or-pending"
  | "device-not-found"
  | "device-unreadable"
  | "constraints-unsatisfied"
  | "insecure-context"
  | "policy-blocked"
  | "request-aborted"
  | "unknown";

export interface MediaAccessError {
  readonly code: MediaAccessErrorCode;
  readonly message: string;
}

export interface DeviceOption {
  readonly deviceId: string;
  readonly kind: MediaKind;
  readonly label: string;
  readonly isDefault: boolean;
}

export type MediaAccessResult =
  | {
      readonly ok: true;
      readonly stream: MediaStream;
      readonly devices: readonly DeviceOption[];
    }
  | { readonly ok: false; readonly error: MediaAccessError };

export interface MediaDevicePort {
  readonly enumerateDevices: () => Promise<readonly DeviceOption[]>;
  readonly requestCamera: (deviceId?: string) => Promise<MediaAccessResult>;
  readonly requestMicrophone: (deviceId?: string) => Promise<MediaAccessResult>;
  readonly stopStream: (stream: MediaStream) => void;
}

export interface BrowserMediaEnvironment {
  readonly isSecureContext?: boolean | undefined;
  readonly mediaDevices?:
    | {
        enumerateDevices?: () => Promise<readonly MediaDeviceInfo[]>;
        getUserMedia?: (
          constraints: MediaStreamConstraints,
        ) => Promise<MediaStream>;
      }
    | undefined;
}

export function createBrowserMediaDeviceService(
  environment: BrowserMediaEnvironment = readBrowserMediaEnvironment(),
): MediaDevicePort {
  return {
    async enumerateDevices() {
      return enumerateDeviceOptions(environment);
    },
    async requestCamera(deviceId) {
      return requestMedia(environment, "camera", deviceId);
    },
    async requestMicrophone(deviceId) {
      return requestMedia(environment, "microphone", deviceId);
    },
    stopStream(stream) {
      stopMediaStream(stream);
    },
  };
}

export function normalizeMediaError(error: unknown): MediaAccessError {
  if (!isDomError(error)) {
    return {
      code: "unknown",
      message: "FairScreen could not access this device.",
    };
  }

  switch (error.name) {
    case "NotAllowedError":
      return {
        code: "permission-denied",
        message: "Permission was denied for this device.",
      };
    case "SecurityError":
      return {
        code: "policy-blocked",
        message: "This browser or page policy blocked device access.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        code: "device-not-found",
        message: "No matching device was found.",
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        code: "device-unreadable",
        message: "The selected device is already in use or cannot be read.",
      };
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return {
        code: "constraints-unsatisfied",
        message: "The selected device could not meet the requested settings.",
      };
    case "AbortError":
      return {
        code: "request-aborted",
        message: "The device request was interrupted.",
      };
    case "TypeError":
      return {
        code: "insecure-context",
        message: "Device access needs a compatible secure browser context.",
      };
    default:
      return {
        code: "unknown",
        message: "FairScreen could not access this device.",
      };
  }
}

export function stopMediaStream(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

async function requestMedia(
  environment: BrowserMediaEnvironment,
  kind: MediaKind,
  deviceId?: string,
): Promise<MediaAccessResult> {
  if (environment.isSecureContext === false) {
    return {
      ok: false,
      error: {
        code: "insecure-context",
        message: "Device access needs a compatible secure browser context.",
      },
    };
  }

  if (!environment.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      error: {
        code: "device-not-found",
        message: "This browser cannot request media devices.",
      },
    };
  }

  const constraints = createConstraints(kind, deviceId);

  try {
    const stream = await environment.mediaDevices.getUserMedia(constraints);
    return {
      ok: true,
      stream,
      devices: await enumerateDeviceOptions(environment),
    };
  } catch (error) {
    return {
      ok: false,
      error: normalizeMediaError(error),
    };
  }
}

async function enumerateDeviceOptions(
  environment: BrowserMediaEnvironment,
): Promise<readonly DeviceOption[]> {
  if (!environment.mediaDevices?.enumerateDevices) {
    return defaultDeviceOptions();
  }

  try {
    const devices = await environment.mediaDevices.enumerateDevices();
    const mappedDevices = devices.flatMap((device, index) =>
      mapMediaDevice(device, index),
    );

    return mappedDevices.length > 0 ? mappedDevices : defaultDeviceOptions();
  } catch {
    return defaultDeviceOptions();
  }
}

function mapMediaDevice(
  device: MediaDeviceInfo,
  index: number,
): readonly DeviceOption[] {
  if (device.kind === "videoinput") {
    return [
      {
        deviceId: device.deviceId,
        kind: "camera",
        label: device.label || `Camera ${index + 1}`,
        isDefault: device.deviceId === "default",
      },
    ];
  }

  if (device.kind === "audioinput") {
    return [
      {
        deviceId: device.deviceId,
        kind: "microphone",
        label: device.label || `Microphone ${index + 1}`,
        isDefault: device.deviceId === "default",
      },
    ];
  }

  return [];
}

function createConstraints(
  kind: MediaKind,
  deviceId?: string,
): MediaStreamConstraints {
  const exactDevice =
    deviceId && deviceId !== "default"
      ? { deviceId: { exact: deviceId } }
      : true;

  if (kind === "camera") {
    return {
      audio: false,
      video: exactDevice,
    };
  }

  return {
    audio: exactDevice,
    video: false,
  };
}

function defaultDeviceOptions(): readonly DeviceOption[] {
  return [
    {
      deviceId: "default",
      kind: "camera",
      label: "Default camera",
      isDefault: true,
    },
    {
      deviceId: "default",
      kind: "microphone",
      label: "Default microphone",
      isDefault: true,
    },
  ];
}

function readBrowserMediaEnvironment(): BrowserMediaEnvironment {
  return {
    isSecureContext: globalThis.isSecureContext,
    mediaDevices: navigator.mediaDevices,
  };
}

function isDomError(error: unknown): error is DOMException {
  return typeof error === "object" && error !== null && "name" in error;
}
