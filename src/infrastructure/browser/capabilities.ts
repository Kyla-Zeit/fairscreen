import type {
  BrowserCapabilityReport,
  CapabilityDetail,
  CapabilityStatus,
  RecorderMimeCapability,
  SpeechCapability,
  StorageCapability,
} from "../../domain/models";
import type { Clock } from "../../domain/ports";
import { SystemClock } from "./providers";
import { estimateStorage, type StorageManagerPort } from "./storageEstimate";

export interface BrowserCapabilityEnvironment {
  readonly isSecureContext?: boolean | undefined;
  readonly mediaDevices?:
    | {
        enumerateDevices?: () => Promise<readonly unknown[]>;
      }
    | undefined;
  readonly AudioContext?: unknown;
  readonly webkitAudioContext?: unknown;
  readonly MediaRecorder?:
    | {
        isTypeSupported?: (mimeType: string) => boolean;
      }
    | undefined;
  readonly Worker?: unknown;
  readonly WebAssembly?: unknown;
  readonly SpeechRecognition?: unknown;
  readonly webkitSpeechRecognition?: unknown;
  readonly indexedDB?: unknown;
  readonly storage?: StorageManagerPort | undefined;
  readonly print?: unknown;
  readonly Blob?: unknown;
  readonly URL?:
    | {
        createObjectURL?: unknown;
        revokeObjectURL?: unknown;
      }
    | undefined;
}

export interface BrowserCapabilityService {
  readonly getReport: () => Promise<BrowserCapabilityReport>;
}

const recorderMimeCandidates = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "audio/webm;codecs=opus",
  "audio/webm",
] as const;

export function createBrowserCapabilityService(
  environment: BrowserCapabilityEnvironment = readBrowserEnvironment(),
  clock: Clock = new SystemClock(),
): BrowserCapabilityService {
  return {
    async getReport() {
      const report = createUnknownCapabilityReport(clock);
      const secureContext = detail(
        environment.isSecureContext === true ? "supported" : "limited",
        environment.isSecureContext === true
          ? "Available"
          : "Limited outside a secure browser context",
        environment.isSecureContext === true
          ? undefined
          : "Camera and microphone requests may be unavailable.",
      );

      const mediaDevices = detail(
        environment.mediaDevices ? "supported" : "unsupported",
        environment.mediaDevices ? "Available" : "Unavailable",
        environment.mediaDevices
          ? undefined
          : "This browser does not expose media devices to FairScreen.",
      );

      const deviceEnumeration = await detectDeviceEnumeration(environment);
      const webAudio = detail(
        environment.AudioContext || environment.webkitAudioContext
          ? "supported"
          : "unsupported",
        environment.AudioContext || environment.webkitAudioContext
          ? "Available"
          : "Unavailable",
      );
      const mediaRecorder = detectMediaRecorder(environment);
      const recorderMimeTypes = detectRecorderMimeTypes(environment);
      const worker = detail(
        environment.Worker ? "supported" : "unsupported",
        environment.Worker ? "Available" : "Unavailable",
      );
      const webAssembly = detail(
        environment.WebAssembly ? "supported" : "unsupported",
        environment.WebAssembly ? "Available" : "Unavailable",
      );
      const speechRecognition = detectSpeechRecognition(environment);
      const storage = await detectStorage(environment);
      const print = detail(
        environment.print ? "supported" : "unsupported",
        environment.print ? "Available" : "Unavailable",
      );
      const hasBlobDownload = Boolean(
        environment.Blob &&
        environment.URL?.createObjectURL &&
        environment.URL.revokeObjectURL,
      );
      const blobDownload = detail(
        hasBlobDownload ? "supported" : "unsupported",
        hasBlobDownload ? "Available" : "Unavailable",
      );

      const limitations = [
        secureContext,
        mediaDevices,
        deviceEnumeration,
        webAudio,
        mediaRecorder,
        worker,
        webAssembly,
        report.mediaPipeFaceLandmarker,
        speechCapabilityDetail(speechRecognition),
        storage.indexedDb,
        storage.estimate,
        print,
        blobDownload,
      ]
        .filter((capability) => capability.status !== "supported")
        .map((capability) => capability.reason ?? capability.label);

      return {
        ...report,
        capturedAt: clock.now(),
        secureContext,
        mediaDevices,
        deviceEnumeration,
        webAudio,
        mediaRecorder,
        recorderMimeTypes,
        worker,
        webAssembly,
        speechRecognition,
        storage,
        print,
        blobDownload,
        limitations,
      };
    },
  };
}

export function createUnknownCapabilityReport(
  clock: Clock = new SystemClock(),
): BrowserCapabilityReport {
  return {
    schemaVersion: 1,
    capturedAt: clock.now(),
    secureContext: unknownDetail("Secure context"),
    mediaDevices: unknownDetail("Media devices"),
    deviceEnumeration: unknownDetail("Device enumeration"),
    webAudio: unknownDetail("Web Audio"),
    mediaRecorder: unknownDetail("MediaRecorder"),
    recorderMimeTypes: recorderMimeCandidates.map((mimeType) => ({
      mimeType,
      reportedSupported: false,
      trialResult: "not-run",
    })),
    worker: unknownDetail("Worker"),
    webAssembly: unknownDetail("WebAssembly"),
    mediaPipeFaceLandmarker: {
      status: "unknown",
      label: "Not initialized",
      reason: "Local video-condition checks have not been initialized.",
      fallback: "Device setup can continue without local video conditions.",
    },
    speechRecognition: {
      status: "unknown",
      constructorKind: "none",
      processingMode: "unknown",
      localProcessingControl: "unknown",
      disclosureRequired: true,
    },
    storage: {
      indexedDb: unknownDetail("IndexedDB"),
      estimate: unknownDetail("Storage estimate"),
      persistenceRequest: {
        status: "unknown",
        label: "Not requested",
        reason: "FairScreen has not requested persistent storage.",
      },
    },
    print: unknownDetail("Print"),
    blobDownload: unknownDetail("Blob download"),
    limitations: [],
  };
}

export function capabilityStatusLabel(status: CapabilityStatus): string {
  switch (status) {
    case "supported":
      return "Available";
    case "limited":
      return "Limited";
    case "unsupported":
      return "Unavailable";
    case "blocked":
      return "Permission needed";
    case "unknown":
      return "Unknown";
  }
}

function readBrowserEnvironment(): BrowserCapabilityEnvironment {
  const windowLike = globalThis as typeof globalThis & {
    AudioContext?: unknown;
    webkitAudioContext?: unknown;
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };

  return {
    isSecureContext: windowLike.isSecureContext,
    mediaDevices: navigator.mediaDevices,
    AudioContext: windowLike.AudioContext,
    webkitAudioContext: windowLike.webkitAudioContext,
    MediaRecorder: windowLike.MediaRecorder,
    Worker: windowLike.Worker,
    WebAssembly: windowLike.WebAssembly,
    SpeechRecognition: windowLike.SpeechRecognition,
    webkitSpeechRecognition: windowLike.webkitSpeechRecognition,
    indexedDB: windowLike.indexedDB,
    storage: navigator.storage,
    print: windowLike.print,
    Blob: windowLike.Blob,
    URL: windowLike.URL,
  };
}

async function detectDeviceEnumeration(
  environment: BrowserCapabilityEnvironment,
): Promise<CapabilityDetail> {
  if (!environment.mediaDevices?.enumerateDevices) {
    return detail(
      "unsupported",
      "Unavailable",
      "This browser cannot enumerate media devices.",
    );
  }

  try {
    await environment.mediaDevices.enumerateDevices();
    return detail("supported", "Available");
  } catch {
    return detail(
      "limited",
      "Limited",
      "Device labels may appear only after permission is granted.",
      "Use the default camera or microphone until labels are available.",
    );
  }
}

function detectMediaRecorder(
  environment: BrowserCapabilityEnvironment,
): CapabilityDetail {
  if (!environment.MediaRecorder) {
    return detail("unsupported", "Unavailable");
  }

  return detail("supported", "Available");
}

function detectRecorderMimeTypes(
  environment: BrowserCapabilityEnvironment,
): readonly RecorderMimeCapability[] {
  return recorderMimeCandidates.map((mimeType) => ({
    mimeType,
    reportedSupported:
      environment.MediaRecorder?.isTypeSupported?.(mimeType) ?? false,
    trialResult: "not-run",
  }));
}

function detectSpeechRecognition(
  environment: BrowserCapabilityEnvironment,
): SpeechCapability {
  if (environment.SpeechRecognition) {
    return {
      status: "limited",
      constructorKind: "standard",
      processingMode: "remote",
      localProcessingControl: "unknown",
      disclosureRequired: true,
    };
  }

  if (environment.webkitSpeechRecognition) {
    return {
      status: "limited",
      constructorKind: "prefixed",
      processingMode: "remote",
      localProcessingControl: "unknown",
      disclosureRequired: true,
    };
  }

  return {
    status: "unsupported",
    constructorKind: "none",
    processingMode: "unknown",
    localProcessingControl: "unknown",
    disclosureRequired: true,
  };
}

async function detectStorage(
  environment: BrowserCapabilityEnvironment,
): Promise<StorageCapability> {
  const estimate = await estimateStorage(environment.storage);
  const indexedDb = environment.indexedDB
    ? detail("supported", "Available")
    : detail(
        "unsupported",
        "Unavailable",
        "Local session storage is not available in this browser context.",
        "Use ephemeral mode for this practice.",
      );

  const estimateDetail =
    estimate.status === "available"
      ? detail("supported", "Available")
      : detail("limited", "Limited", estimate.reason);

  return {
    indexedDb,
    estimate: estimateDetail,
    persistenceRequest: {
      status: "unknown",
      label: "Not requested",
      reason: "Persistent storage has not been requested.",
    },
    ...(estimate.status === "available"
      ? {
          estimatedUsageBytes: estimate.usageBytes,
          ...(estimate.quotaBytes === undefined
            ? {}
            : { estimatedQuotaBytes: estimate.quotaBytes }),
        }
      : {}),
  };
}

function speechCapabilityDetail(
  capability: SpeechCapability,
): CapabilityDetail {
  return {
    status: capability.status,
    label: capabilityStatusLabel(capability.status),
  };
}

function detail(
  status: CapabilityStatus,
  label: string,
  reason?: string,
  fallback?: string,
): CapabilityDetail {
  return {
    status,
    label,
    ...(reason === undefined ? {} : { reason }),
    ...(fallback === undefined ? {} : { fallback }),
  };
}

function unknownDetail(label: string): CapabilityDetail {
  return {
    status: "unknown",
    label,
  };
}
