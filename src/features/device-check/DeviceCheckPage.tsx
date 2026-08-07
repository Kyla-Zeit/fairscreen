import { Eye, EyeOff, Mic, RefreshCw, Square, Video } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useNavigate } from "react-router-dom";

import { useBrowserServices } from "../../app/BrowserServicesProvider";
import type {
  BrowserCapabilityReport,
  CapabilityDetail,
  CapabilityStatus,
} from "../../domain/models";
import type {
  MicrophoneLevelMonitor,
  MicrophoneLevelReading,
} from "../../infrastructure/browser/audioLevels";
import {
  capabilityStatusLabel,
  createUnknownCapabilityReport,
} from "../../infrastructure/browser/capabilities";
import type {
  DeviceOption,
  MediaAccessError,
  MediaKind,
} from "../../infrastructure/browser/mediaDevices";
import { Button } from "../../shared/components/Button";
import { Notice } from "../../shared/components/Notice";
import { PageContainer } from "../../shared/components/PageContainer";
import { PageHeader } from "../../shared/components/PageHeader";
import { Status } from "../../shared/components/Status";
import { useResourceRegistry } from "../../app/ResourceRegistryProvider";
import { createSessionIdFromDraft } from "../interview/progressPersistence";
import { interviewSessionPath } from "../interview/sessionRoute";
import { useSetupDraft } from "../setup/SetupDraftProvider";
import type { SetupDraft } from "../setup/setupDraft";

type PermissionUiState =
  | "not-requested"
  | "requesting"
  | "pending"
  | "available"
  | "denied"
  | "unavailable"
  | "stopped"
  | "skipped";

interface DeviceState {
  readonly status: PermissionUiState;
  readonly error?: MediaAccessError;
}

const initialDeviceState: DeviceState = {
  status: "not-requested",
};

const defaultCameraDevice: DeviceOption = {
  deviceId: "default",
  kind: "camera",
  label: "Default camera",
  isDefault: true,
};

const defaultMicrophoneDevice: DeviceOption = {
  deviceId: "default",
  kind: "microphone",
  label: "Default microphone",
  isDefault: true,
};

export function DeviceCheckPage() {
  const navigate = useNavigate();
  const registry = useResourceRegistry();
  const { capabilities, createMicrophoneLevelMonitor, mediaDevices } =
    useBrowserServices();
  const { draft, updateDraft } = useSetupDraft();
  const [report, setReport] = useState<BrowserCapabilityReport>(() =>
    createUnknownCapabilityReport(),
  );
  const [reportState, setReportState] = useState<
    "idle" | "running" | "complete" | "failed"
  >("idle");
  const [cameraState, setCameraState] =
    useState<DeviceState>(initialDeviceState);
  const [microphoneState, setMicrophoneState] =
    useState<DeviceState>(initialDeviceState);
  const [cameraDevices, setCameraDevices] = useState<readonly DeviceOption[]>([
    defaultCameraDevice,
  ]);
  const [microphoneDevices, setMicrophoneDevices] = useState<
    readonly DeviceOption[]
  >([defaultMicrophoneDevice]);
  const [selectedCameraId, setSelectedCameraId] = useState("default");
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState("default");
  const [hidePreview, setHidePreview] = useState(false);
  const [mirrorPreview, setMirrorPreview] = useState(true);
  const [levelReading, setLevelReading] = useState<MicrophoneLevelReading>({
    percent: 0,
    text: "No level yet",
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const microphoneMonitorRef = useRef<MicrophoneLevelMonitor | null>(null);
  const unregisterCameraRef = useRef<(() => void) | null>(null);
  const unregisterMicrophoneRef = useRef<(() => void) | null>(null);
  const unregisterMonitorRef = useRef<(() => void) | null>(null);
  const requestTimerRef = useRef<number | null>(null);

  const supportRows = useMemo(() => createSupportRows(report), [report]);
  const selectedMediaSummary = useMemo(() => {
    if (draft.cameraRequested && draft.microphoneRequested) {
      return "Camera and microphone review selected";
    }

    if (draft.cameraRequested) {
      return "Camera review selected";
    }

    if (draft.microphoneRequested) {
      return "Microphone review selected";
    }

    return "No camera or microphone review selected";
  }, [draft.cameraRequested, draft.microphoneRequested]);
  const beginPracticeIssues = useMemo(
    () =>
      createBeginPracticeIssues({
        draft,
        cameraStatus: cameraState.status,
        microphoneStatus: microphoneState.status,
      }),
    [draft, cameraState.status, microphoneState.status],
  );
  const canBeginPractice = beginPracticeIssues.length === 0;

  const clearPendingTimer = useCallback(() => {
    if (requestTimerRef.current !== null) {
      window.clearTimeout(requestTimerRef.current);
      requestTimerRef.current = null;
    }
  }, []);

  const markPendingLater = useCallback(
    (callback: () => void) => {
      clearPendingTimer();
      requestTimerRef.current = window.setTimeout(callback, 1200);
    },
    [clearPendingTimer],
  );

  const cleanupAll = useCallback(async () => {
    clearPendingTimer();
    setLevelReading({ percent: 0, text: "No level yet" });
    setCameraState((current) =>
      current.status === "available" ? { status: "stopped" } : current,
    );
    setMicrophoneState((current) =>
      current.status === "available" ? { status: "stopped" } : current,
    );

    await registry.disposeAll("manual-stop");

    cameraStreamRef.current = null;
    microphoneStreamRef.current = null;
    microphoneMonitorRef.current = null;
    unregisterCameraRef.current = null;
    unregisterMicrophoneRef.current = null;
    unregisterMonitorRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [clearPendingTimer, registry]);

  useEffect(() => {
    const handlePageHide = () => {
      void cleanupAll();
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      void cleanupAll();
    };
  }, [cleanupAll]);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.srcObject = cameraStreamRef.current;
  }, [cameraState.status]);

  async function runCapabilityReport() {
    setReportState("running");
    try {
      const nextReport = await capabilities.getReport();
      setReport(nextReport);
      setReportState("complete");
      if (nextReport.storage.indexedDb.status !== "supported") {
        updateDraft({ storageMode: "ephemeral" });
      }
    } catch {
      setReport(createUnknownCapabilityReport());
      setReportState("failed");
      updateDraft({ storageMode: "ephemeral" });
    }
  }

  async function requestCamera(deviceId = selectedCameraId) {
    setCameraState({ status: "requesting" });
    markPendingLater(() => {
      setCameraState((current) =>
        current.status === "requesting" ? { status: "pending" } : current,
      );
    });

    const result = await mediaDevices.requestCamera(deviceId);
    clearPendingTimer();

    if (!result.ok) {
      setCameraState({
        status: isUnavailableError(result.error.code)
          ? "unavailable"
          : "denied",
        error: result.error,
      });
      return;
    }

    disposeCameraStream();
    cameraStreamRef.current = result.stream;
    unregisterCameraRef.current = registry.register({
      id: "camera-preview-stream",
      dispose: () => {
        mediaDevices.stopStream(result.stream);
      },
    });
    setCameraDevices(filterDeviceOptions(result.devices, "camera"));
    setSelectedCameraId(deviceId);
    setCameraState({ status: "available" });
  }

  async function requestMicrophone(deviceId = selectedMicrophoneId) {
    setMicrophoneState({ status: "requesting" });
    markPendingLater(() => {
      setMicrophoneState((current) =>
        current.status === "requesting" ? { status: "pending" } : current,
      );
    });

    const result = await mediaDevices.requestMicrophone(deviceId);
    clearPendingTimer();

    if (!result.ok) {
      setMicrophoneState({
        status: isUnavailableError(result.error.code)
          ? "unavailable"
          : "denied",
        error: result.error,
      });
      return;
    }

    disposeMicrophoneStream();
    microphoneStreamRef.current = result.stream;
    unregisterMicrophoneRef.current = registry.register({
      id: "microphone-check-stream",
      dispose: () => {
        mediaDevices.stopStream(result.stream);
      },
    });

    const monitor = createMicrophoneLevelMonitor(result.stream);
    microphoneMonitorRef.current = monitor;
    unregisterMonitorRef.current = registry.register({
      id: "microphone-level-monitor",
      dispose: () => monitor.stop(),
    });
    monitor.subscribe(setLevelReading);

    setMicrophoneDevices(filterDeviceOptions(result.devices, "microphone"));
    setSelectedMicrophoneId(deviceId);
    setMicrophoneState({ status: "available" });
  }

  function continueWithoutCamera() {
    disposeCameraStream();
    setCameraState({ status: "skipped" });
    updateDraft({
      cameraRequested: false,
      recordingCaptureRequested: draft.microphoneRequested
        ? draft.recordingCaptureRequested
        : false,
    });
  }

  function continueWithoutMicrophone() {
    disposeMicrophoneStream();
    setMicrophoneState({ status: "skipped" });
    updateDraft({
      microphoneRequested: false,
      recordingCaptureRequested: draft.cameraRequested
        ? draft.recordingCaptureRequested
        : false,
    });
  }

  function handleCameraDeviceChange(event: ChangeEvent<HTMLSelectElement>) {
    const deviceId = event.target.value;
    setSelectedCameraId(deviceId);
    if (cameraState.status === "available") {
      void requestCamera(deviceId);
    }
  }

  function handleMicrophoneDeviceChange(event: ChangeEvent<HTMLSelectElement>) {
    const deviceId = event.target.value;
    setSelectedMicrophoneId(deviceId);
    if (microphoneState.status === "available") {
      void requestMicrophone(deviceId);
    }
  }

  function beginPractice() {
    if (!canBeginPractice) {
      return;
    }

    void navigate(
      interviewSessionPath(createSessionIdFromDraft(draft), "practice"),
    );
  }

  function disposeCameraStream() {
    unregisterCameraRef.current?.();
    unregisterCameraRef.current = null;

    if (cameraStreamRef.current) {
      mediaDevices.stopStream(cameraStreamRef.current);
      cameraStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function disposeMicrophoneStream() {
    unregisterMonitorRef.current?.();
    unregisterMonitorRef.current = null;
    unregisterMicrophoneRef.current?.();
    unregisterMicrophoneRef.current = null;

    void microphoneMonitorRef.current?.stop();
    microphoneMonitorRef.current = null;

    if (microphoneStreamRef.current) {
      mediaDevices.stopStream(microphoneStreamRef.current);
      microphoneStreamRef.current = null;
    }

    setLevelReading({ percent: 0, text: "No level yet" });
  }

  return (
    <PageContainer className="page-stack device-page">
      <PageHeader
        eyebrow="Device review"
        title="Check your setup"
        lead={
          <p>
            Camera and microphone access are optional. FairScreen asks only for
            the devices you selected. You can continue without either one.
          </p>
        }
        actions={
          <Button
            icon={<Square aria-hidden="true" size={18} />}
            onClick={() => void cleanupAll()}
            type="button"
            variant="danger"
          >
            Stop devices
          </Button>
        }
      />

      <Notice title="Your practice mode" variant="privacy">
        <p>
          You can complete the full question and transcript workflow. Camera
          conditions and audio timing will not be available unless you choose
          those devices here. You can type or paste each answer for content
          coaching.
        </p>
        <p>{selectedMediaSummary}.</p>
        {draft.storageMode === "ephemeral" ? (
          <p>
            Ephemeral mode is active for this setup because persistent local
            storage is unavailable or has not been confirmed.
          </p>
        ) : null}
      </Notice>

      <section className="section-block" aria-labelledby="capability-title">
        <div className="section-heading">
          <h2 id="capability-title">Browser support</h2>
          <p>
            Re-checking support does not ask for camera or microphone
            permission.
          </p>
        </div>
        <div className="action-row">
          <Button
            disabled={reportState === "running"}
            icon={<RefreshCw aria-hidden="true" size={18} />}
            onClick={() => void runCapabilityReport()}
            type="button"
            variant="secondary"
          >
            {reportState === "complete" ? "Re-check support" : "Check support"}
          </Button>
          {reportState === "running" ? (
            <Status tone="info">Checking browser support...</Status>
          ) : null}
          {reportState === "failed" ? (
            <Status tone="warning">
              Support could not be checked. Ephemeral mode is available.
            </Status>
          ) : null}
        </div>
        <div className="table-wrap">
          <table>
            <caption>Browser support summary</caption>
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">Status</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {supportRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.status}</td>
                  <td>{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="disclosure">
          <summary className="disclosure__summary">
            MediaRecorder MIME candidates
          </summary>
          <div className="disclosure__body">
            <ul className="plain-list">
              {report.recorderMimeTypes.map((candidate) => (
                <li key={candidate.mimeType}>
                  <code>{candidate.mimeType}</code>:{" "}
                  {candidate.reportedSupported ? "Available" : "Unavailable"};
                  trial {candidate.trialResult}
                </li>
              ))}
            </ul>
          </div>
        </details>
        {report.storage.indexedDb.status !== "supported" ? (
          <Button
            onClick={() => {
              updateDraft({ storageMode: "ephemeral" });
            }}
            type="button"
            variant="secondary"
          >
            Use ephemeral mode
          </Button>
        ) : null}
      </section>

      <div className="device-grid">
        <section
          className="device-panel"
          aria-labelledby="camera-permission-title"
        >
          <div className="device-panel__header">
            <Video aria-hidden="true" size={24} />
            <div>
              <h2 id="camera-permission-title">Camera</h2>
              <p>{permissionStateLabel(cameraState.status)}</p>
            </div>
          </div>
          <p>
            Use the camera for a local preview and optional video-call condition
            measurements. Video is not uploaded to FairScreen.
          </p>
          {isPendingState(cameraState.status) ? (
            <Status tone="info">
              Waiting for your browser's permission choice...
            </Status>
          ) : null}
          {cameraState.error ? (
            <Status tone="warning">{cameraState.error.message}</Status>
          ) : null}
          <div className="action-row">
            <Button
              disabled={cameraState.status === "requesting"}
              icon={<Video aria-hidden="true" size={18} />}
              onClick={() => void requestCamera()}
              type="button"
            >
              Allow camera
            </Button>
            <Button
              onClick={continueWithoutCamera}
              type="button"
              variant="secondary"
            >
              Continue without camera
            </Button>
          </div>
          <DeviceSelect
            devices={cameraDevices}
            id="camera-selector"
            label="Camera selector"
            onChange={handleCameraDeviceChange}
            value={selectedCameraId}
          />
          <div className="preview-controls">
            <label className="check-control">
              <input
                checked={hidePreview}
                onChange={(event) => {
                  setHidePreview(event.target.checked);
                }}
                type="checkbox"
              />
              <span>Hide my preview</span>
            </label>
            <label className="check-control">
              <input
                checked={mirrorPreview}
                onChange={(event) => {
                  setMirrorPreview(event.target.checked);
                }}
                type="checkbox"
              />
              <span>Mirror preview</span>
            </label>
          </div>
          <div className="camera-preview" aria-label="Camera preview">
            {hidePreview ? (
              <div className="camera-preview__hidden">
                <EyeOff aria-hidden="true" size={28} />
                <p>Preview hidden</p>
              </div>
            ) : (
              <video
                aria-label="Camera preview video"
                autoPlay
                className={
                  mirrorPreview
                    ? "camera-preview__video mirror"
                    : "camera-preview__video"
                }
                muted
                playsInline
                ref={videoRef}
              />
            )}
          </div>
          <ul className="condition-list" aria-label="Video condition notes">
            <li>Face shape detected: Not available</li>
            <li>Broad centre guide: Not available</li>
            <li>Lighting: Not available</li>
            <li>Video analysis not available</li>
          </ul>
        </section>

        <section
          className="device-panel"
          aria-labelledby="microphone-permission-title"
        >
          <div className="device-panel__header">
            <Mic aria-hidden="true" size={24} />
            <div>
              <h2 id="microphone-permission-title">Microphone</h2>
              <p>{permissionStateLabel(microphoneState.status)}</p>
            </div>
          </div>
          <p>
            Use the microphone for a level check, timing estimates, and optional
            recording or transcription.
          </p>
          {isPendingState(microphoneState.status) ? (
            <Status tone="info">
              Waiting for your browser's permission choice...
            </Status>
          ) : null}
          {microphoneState.error ? (
            <Status tone="warning">{microphoneState.error.message}</Status>
          ) : null}
          <div className="action-row">
            <Button
              disabled={microphoneState.status === "requesting"}
              icon={<Mic aria-hidden="true" size={18} />}
              onClick={() => void requestMicrophone()}
              type="button"
            >
              Allow microphone
            </Button>
            <Button
              onClick={continueWithoutMicrophone}
              type="button"
              variant="secondary"
            >
              Continue without microphone
            </Button>
          </div>
          <DeviceSelect
            devices={microphoneDevices}
            id="microphone-selector"
            label="Microphone selector"
            onChange={handleMicrophoneDeviceChange}
            value={selectedMicrophoneId}
          />
          <div className="mic-meter">
            <div
              aria-label="Microphone level"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={levelReading.percent}
              aria-valuetext={levelReading.text}
              className="mic-meter__track"
              role="meter"
            >
              <span style={{ inlineSize: `${levelReading.percent}%` }} />
            </div>
            <p>{levelReading.text}</p>
          </div>
        </section>
      </div>

      <div className="form-actions">
        {beginPracticeIssues.length > 0 ? (
          <Status tone="warning">
            {beginPracticeIssues.length === 1
              ? beginPracticeIssues[0]
              : `Before beginning, ${beginPracticeIssues.join(" ")}`}
          </Status>
        ) : null}
        <Button disabled={!canBeginPractice} onClick={beginPractice}>
          Begin practice
        </Button>
        <Button
          onClick={() => {
            void navigate("/interviews/new");
          }}
          variant="secondary"
        >
          Change setup
        </Button>
        <Button
          icon={<Eye aria-hidden="true" size={18} />}
          onClick={() => void cleanupAll()}
          type="button"
          variant="quiet"
        >
          Stop camera and microphone
        </Button>
      </div>
    </PageContainer>
  );
}

function DeviceSelect({
  devices,
  id,
  label,
  onChange,
  value,
}: {
  readonly devices: readonly DeviceOption[];
  readonly id: string;
  readonly label: string;
  readonly onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly value: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} onChange={onChange} value={value}>
        {devices.map((device) => (
          <option
            key={`${device.kind}-${device.deviceId}`}
            value={device.deviceId}
          >
            {device.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function createBeginPracticeIssues({
  draft,
  cameraStatus,
  microphoneStatus,
}: {
  readonly draft: Pick<SetupDraft, "cameraRequested" | "microphoneRequested">;
  readonly cameraStatus: PermissionUiState;
  readonly microphoneStatus: PermissionUiState;
}) {
  const issues: string[] = [];
  if (draft.cameraRequested && cameraStatus !== "available") {
    issues.push(
      "Test the requested camera or choose Continue without camera before beginning.",
    );
  }

  if (draft.microphoneRequested && microphoneStatus !== "available") {
    issues.push(
      "Test the requested microphone or choose Continue without microphone before beginning.",
    );
  }

  return issues;
}

function createSupportRows(report: BrowserCapabilityReport) {
  return [
    createSupportRow("Preview", report.mediaDevices),
    createSupportRow("Audio timing", report.webAudio),
    createSupportRow("Local video conditions", report.mediaPipeFaceLandmarker),
    createSupportRow("Recording", report.mediaRecorder),
    createSupportRow(
      "Browser transcription",
      speechCapabilityToDetail(report.speechRecognition.status),
    ),
    createSupportRow("Local sessions", report.storage.indexedDb),
  ] as const;
}

function createSupportRow(label: string, capability: CapabilityDetail) {
  return {
    label,
    status: supportStatusLabel(capability.status),
    reason: capability.reason ?? capability.fallback ?? capability.label,
  };
}

function speechCapabilityToDetail(status: CapabilityStatus): CapabilityDetail {
  return {
    status,
    label: capabilityStatusLabel(status),
  };
}

function supportStatusLabel(status: CapabilityStatus): string {
  if (status === "unknown") {
    return "Unknown";
  }

  return capabilityStatusLabel(status);
}

function filterDeviceOptions(
  devices: readonly DeviceOption[],
  kind: MediaKind,
): readonly DeviceOption[] {
  const filtered = devices.filter((device) => device.kind === kind);
  if (filtered.length > 0) {
    return filtered;
  }

  return kind === "camera" ? [defaultCameraDevice] : [defaultMicrophoneDevice];
}

function permissionStateLabel(status: PermissionUiState): string {
  switch (status) {
    case "not-requested":
      return "Not requested";
    case "requesting":
      return "Requesting";
    case "pending":
      return "Requesting";
    case "available":
      return "Available";
    case "denied":
      return "Denied/unavailable";
    case "unavailable":
      return "Denied/unavailable";
    case "stopped":
      return "Not requested";
    case "skipped":
      return "Not requested";
  }
}

function isPendingState(status: PermissionUiState) {
  return status === "requesting" || status === "pending";
}

function isUnavailableError(code: MediaAccessError["code"]) {
  return [
    "device-not-found",
    "device-unreadable",
    "constraints-unsatisfied",
    "insecure-context",
    "policy-blocked",
  ].includes(code);
}
