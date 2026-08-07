import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  BrowserServicesProvider,
  type BrowserServices,
} from "../../app/BrowserServicesProvider";
import { ResourceRegistryProvider } from "../../app/ResourceRegistryProvider";
import {
  createUnknownCapabilityReport,
  type BrowserCapabilityService,
} from "../../infrastructure/browser/capabilities";
import type { MicrophoneLevelReading } from "../../infrastructure/browser/audioLevels";
import type { MediaDevicePort } from "../../infrastructure/browser/mediaDevices";
import { createUnavailableTranscriptionProvider } from "../../infrastructure/browser/speechRecognition";
import { createDeterministicAnswerAnalyzer } from "../analysis/DeterministicAnswerAnalyzer";
import { SetupDraftProvider } from "../setup/SetupDraftProvider";
import { createDefaultSetupDraft, type SetupDraft } from "../setup/setupDraft";
import { DeviceCheckPage } from "./DeviceCheckPage";

describe("DeviceCheckPage", () => {
  it("does not request media on load or capability re-check", async () => {
    const user = userEvent.setup();
    const services = createFakeServices();

    renderDeviceCheck(services);

    expect(services.mediaDevices.requestCamera).not.toHaveBeenCalled();
    expect(services.mediaDevices.requestMicrophone).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Check support" }));

    expect(services.capabilities.getReport).toHaveBeenCalledTimes(1);
    expect(services.mediaDevices.requestCamera).not.toHaveBeenCalled();
    expect(services.mediaDevices.requestMicrophone).not.toHaveBeenCalled();
  });

  it("requests camera and microphone separately and shows accessible mic text", async () => {
    const user = userEvent.setup();
    const services = createFakeServices();

    renderDeviceCheck(services);

    await user.click(screen.getByRole("button", { name: "Allow camera" }));

    await waitFor(() => {
      expect(services.mediaDevices.requestCamera).toHaveBeenCalledTimes(1);
    });
    expect(services.mediaDevices.requestMicrophone).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Allow microphone" }));

    await waitFor(() => {
      expect(services.mediaDevices.requestMicrophone).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByRole("meter", { name: "Microphone level" }),
    ).toHaveAttribute("aria-valuetext", "Signal detected");
    expect(screen.getByText("Signal detected")).toBeInTheDocument();
  });

  it("prevents beginning with requested devices until they are tested or skipped", async () => {
    const user = userEvent.setup();
    const services = createFakeServices();

    renderDeviceCheck(services);

    const beginPractice = screen.getByRole("button", {
      name: "Begin practice",
    });
    expect(beginPractice).toBeDisabled();
    expect(screen.getByText(/Test the requested camera/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Allow camera" }));
    await waitFor(() => {
      expect(services.mediaDevices.requestCamera).toHaveBeenCalledTimes(1);
    });
    expect(beginPractice).toBeDisabled();
    expect(
      screen.getByText(/Test the requested microphone/),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Continue without microphone" }),
    );

    await waitFor(() => {
      expect(beginPractice).toBeEnabled();
    });
  });

  it("allows no-media setup to begin without device tests", () => {
    const services = createFakeServices();

    renderDeviceCheck(services, {
      ...createDefaultSetupDraft(),
      jobTitle: "Product analyst",
      cameraRequested: false,
      microphoneRequested: false,
      recordingCaptureRequested: false,
    });

    expect(
      screen.getByRole("button", { name: "Begin practice" }),
    ).toBeEnabled();
    expect(screen.queryByText(/Test the requested/)).not.toBeInTheDocument();
  });

  it("preserves setup data when camera permission is denied", async () => {
    const user = userEvent.setup();
    const services = createFakeServices({
      cameraResult: {
        ok: false,
        error: {
          code: "permission-denied",
          message: "Permission was denied for this device.",
        },
      },
    });

    renderDeviceCheck(services);

    await user.click(screen.getByRole("button", { name: "Allow camera" }));

    expect(
      await screen.findByText("Permission was denied for this device."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Camera and microphone review selected."),
    ).toBeInTheDocument();
  });

  it("stops active streams and monitor from the global stop control", async () => {
    const user = userEvent.setup();
    const stream = createFakeStream();
    const monitorStop = vi.fn().mockResolvedValue(undefined);
    const services = createFakeServices({
      cameraResult: {
        ok: true,
        stream,
        devices: [],
      },
      monitorStop,
    });

    renderDeviceCheck(services);

    await user.click(screen.getByRole("button", { name: "Allow camera" }));
    await waitFor(() => {
      expect(services.mediaDevices.requestCamera).toHaveBeenCalledTimes(1);
    });
    await user.click(screen.getByRole("button", { name: "Stop devices" }));

    await waitFor(() => {
      expect(services.mediaDevices.stopStream).toHaveBeenCalledWith(stream);
    });
    expect(monitorStop).not.toHaveBeenCalled();
  });
});

interface FakeServiceOptions {
  readonly cameraResult?: Awaited<ReturnType<MediaDevicePort["requestCamera"]>>;
  readonly microphoneResult?: Awaited<
    ReturnType<MediaDevicePort["requestMicrophone"]>
  >;
  readonly monitorStop?: () => Promise<void>;
}

function renderDeviceCheck(
  services: BrowserServices,
  initialDraft: SetupDraft = {
    ...createDefaultSetupDraft(),
    jobTitle: "Product analyst",
    cameraRequested: true,
    microphoneRequested: true,
  },
) {
  render(
    <ResourceRegistryProvider>
      <BrowserServicesProvider services={services}>
        <SetupDraftProvider initialDraft={initialDraft}>
          <MemoryRouter initialEntries={["/interviews/draft/devices"]}>
            <DeviceCheckPage />
          </MemoryRouter>
        </SetupDraftProvider>
      </BrowserServicesProvider>
    </ResourceRegistryProvider>,
  );
}

function createFakeServices(options: FakeServiceOptions = {}): BrowserServices {
  const stream = createFakeStream();
  const defaultCameraResult = {
    ok: true,
    stream,
    devices: [
      {
        deviceId: "camera-1",
        kind: "camera" as const,
        label: "Front camera",
        isDefault: false,
      },
    ],
  };
  const defaultMicrophoneResult = {
    ok: true,
    stream,
    devices: [
      {
        deviceId: "microphone-1",
        kind: "microphone" as const,
        label: "Desk microphone",
        isDefault: false,
      },
    ],
  };

  const capabilities: BrowserCapabilityService = {
    getReport: vi.fn().mockResolvedValue(createUnknownCapabilityReport()),
  };
  const mediaDevices: MediaDevicePort = {
    enumerateDevices: vi.fn().mockResolvedValue([]),
    requestCamera: vi
      .fn()
      .mockResolvedValue(options.cameraResult ?? defaultCameraResult),
    requestMicrophone: vi
      .fn()
      .mockResolvedValue(options.microphoneResult ?? defaultMicrophoneResult),
    stopStream: vi.fn(),
  };

  return {
    capabilities,
    mediaDevices,
    createMicrophoneLevelMonitor: vi.fn(() => ({
      subscribe: (listener: (reading: MicrophoneLevelReading) => void) => {
        listener({ percent: 46, text: "Signal detected" });
        return () => undefined;
      },
      stop: options.monitorStop ?? vi.fn().mockResolvedValue(undefined),
    })),
    startAudioMetricSession: vi.fn().mockResolvedValue({
      ok: false,
      reason: "unsupported",
    }),
    startRecorderSession: vi.fn(() => ({
      ok: false as const,
      code: "unsupported" as const,
    })),
    startVideoAnalysisSession: vi.fn().mockResolvedValue({
      ok: false,
      reason: "unsupported",
      message: "Video analysis unavailable in this test.",
    }),
    saveRecordingAfterUserChoice: vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: "unavailable",
        operation: "save-recording",
        recoverable: true,
        actions: ["continue-without-recording"],
      },
    }),
    importResumeFile: vi.fn().mockResolvedValue({
      ok: false,
      failure: {
        code: "unsupported-format",
        message: "Choose a supported resume file: PDF, DOCX, or TXT.",
      },
    }),
    importJobPosting: vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: "provider-unavailable",
        message: "Job posting import unavailable.",
        retrievedAt: "2026-01-01T00:00:00.000Z",
      },
    }),
    companyResearch: {
      providerId: "test-company-research",
      research: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: "provider-unavailable",
          message: "Company research unavailable.",
        },
      }),
    },
    transcription: createUnavailableTranscriptionProvider(),
    answerAnalyzer: createDeterministicAnswerAnalyzer(),
  };
}

function createFakeStream() {
  return {
    getTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream;
}
