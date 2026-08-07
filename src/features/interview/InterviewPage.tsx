import {
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  LogOut,
  Play,
  Plus,
  RotateCcw,
  Save,
  SkipForward,
  Square,
  Trash2,
  Video,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useNavigate } from "react-router-dom";

import { useBrowserServices } from "../../app/BrowserServicesProvider";
import { useFairScreenRepository } from "../../app/FairScreenRepositoryProvider";
import { publicAppConfig } from "../../app/config";
import { useResourceRegistry } from "../../app/ResourceRegistryProvider";
import type {
  AvailabilityReason,
  InterviewQuestionId,
  MetricValue,
  QuestionResponseId,
} from "../../domain/common";
import { byteCount, isoDateTime, milliseconds } from "../../domain/factories";
import type {
  AudioMetrics,
  RecordingReference,
  TranscriptResult,
  TranscriptionPreference,
  TranscriptionProcessingMode,
  VideoMetrics,
} from "../../domain/models";
import type { TranscriptionSession } from "../../domain/ports";
import type {
  DeviceOption,
  MediaAccessError,
} from "../../infrastructure/browser/mediaDevices";
import type {
  MediaRecorderSession,
  RecorderFailureCode,
} from "../../infrastructure/browser/mediaRecorder";
import type { WebAudioMetricSession } from "../../infrastructure/browser/webAudioAnalyzer";
import type {
  VideoAnalysisSession,
  VideoAnalysisUpdate,
} from "../../infrastructure/browser/videoAnalysisClient";
import type { SavedRecordingInput } from "../../infrastructure/storage/repositories/IndexedDbRecordingRepository";
import { Button } from "../../shared/components/Button";
import { LinkButton } from "../../shared/components/LinkButton";
import { Notice } from "../../shared/components/Notice";
import { PageContainer } from "../../shared/components/PageContainer";
import { PageHeader } from "../../shared/components/PageHeader";
import { Status } from "../../shared/components/Status";
import { createUnavailableAudioMetrics } from "../audio/audioMetrics";
import type { PracticeCoaching } from "../analysis/DeterministicAnswerAnalyzer";
import { createUnavailableVideoMetrics } from "../video/aggregate";
import {
  createTransientRecordingReview,
  recordingIdForAttempt,
  type TransientRecordingReview,
} from "../recording/transientRecording";
import { useSetupDraft } from "../setup/SetupDraftProvider";
import { toInterviewContext, withFreshSessionSeed } from "../setup/setupDraft";
import {
  createManualTranscriptResult,
  createTimingOnlyTranscriptResult,
  createUnavailableTranscriptResult,
  formatTranscriptParagraphs,
  reviseTranscriptResult,
  transcriptNeedsReview,
} from "../transcription/transcription";
import {
  currentQuestion,
  getQuestionAttempts,
  hasInProgressWork,
  interviewReducer,
  recoverToSafeInterviewState,
  type InterviewEvent,
  type InterviewMachineState,
} from "./machine";
import {
  selectLivePrompt,
  shouldPresentLivePrompt,
  type LivePrompt,
} from "./liveCoaching";
import {
  createInterviewStateFromDraft,
  projectInterviewProgress,
  recoverInterviewProgress,
  saveInterviewProgress,
  serializeInterviewProgress,
} from "./progressPersistence";
import { createBrowserInterviewProgressStore } from "./progressStore";
import { interviewSessionPath } from "./sessionRoute";
import {
  createTimerSnapshot,
  formatDuration,
  timerAnnouncementsBetween,
} from "./timing";

type ConfirmAction = "end" | "exit" | "skip" | null;
type RecordingPromptAction = "save-review" | "repeat" | "end" | "exit" | null;
type PendingSpeechDisclosure = {
  readonly processingMode: TranscriptionProcessingMode;
  readonly limitations: readonly string[];
} | null;

type InterviewEventInput = InterviewEvent extends infer Event
  ? Event extends InterviewEvent
    ? Omit<Event, "eventId" | "nowMs" | "occurredAt">
    : never
  : never;

interface CaptureUiState {
  readonly status:
    | "idle"
    | "not-requested"
    | "starting"
    | "active"
    | "stopped"
    | "unavailable";
  readonly message: string;
}

interface ActiveAnswerCapture {
  readonly attemptId: QuestionResponseId;
  readonly startedAtMs: number;
  readonly microphoneStream?: MediaStream | undefined;
  readonly cameraStream?: MediaStream | undefined;
  readonly audioSession?: WebAudioMetricSession | undefined;
  readonly videoSession?: VideoAnalysisSession | undefined;
  readonly recorderSession?: MediaRecorderSession | undefined;
  readonly audioUnavailableReason?: AvailabilityReason | undefined;
  readonly videoUnavailableReason?: AvailabilityReason | undefined;
  readonly recorderFailureCode?: RecorderFailureCode | undefined;
  readonly unregisters: readonly (() => void)[];
}

interface FinalizedCapture {
  readonly attemptId: QuestionResponseId;
  readonly audioMetrics: AudioMetrics;
  readonly videoMetrics: VideoMetrics;
}

interface RecordingReviewState {
  readonly handle: TransientRecordingReview;
  readonly saveStatus: "idle" | "saving" | "saved" | "failed";
  readonly errorMessage?: string | undefined;
  readonly savedReference?: RecordingReference | undefined;
}

const defaultMicrophoneDevice: DeviceOption = {
  deviceId: "default",
  kind: "microphone",
  label: "Default microphone",
  isDefault: true,
};

const defaultCameraDevice: DeviceOption = {
  deviceId: "default",
  kind: "camera",
  label: "Default camera",
  isDefault: true,
};

export function InterviewPage() {
  const navigate = useNavigate();
  const registry = useResourceRegistry();
  const {
    answerAnalyzer,
    mediaDevices,
    saveRecordingAfterUserChoice,
    startAudioMetricSession,
    startRecorderSession,
    startVideoAnalysisSession,
    transcription,
  } = useBrowserServices();
  const { draft, replaceDraft } = useSetupDraft();
  const { repository, status: repositoryStatus } = useFairScreenRepository();
  const progressStore = useMemo(
    () => createBrowserInterviewProgressStore(),
    [],
  );
  const createdState = useMemo(
    () => createInterviewStateFromDraft(draft),
    [draft],
  );
  const recoveredProgress = useMemo(
    () => progressStore.read(createdState.sessionId),
    [createdState.sessionId, progressStore],
  );
  const initialState = useMemo(
    () =>
      recoveredProgress
        ? recoverInterviewProgress(recoveredProgress)
        : createdState,
    [createdState, recoveredProgress],
  );
  const [machine, dispatchMachine] = useReducer(interviewReducer, initialState);
  const [nowMs, setNowMs] = useState(() => monotonicNowMs());
  const [timerLiveMessage, setTimerLiveMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [recordingPromptAction, setRecordingPromptAction] =
    useState<RecordingPromptAction>(null);
  const [microphoneDevices, setMicrophoneDevices] = useState<
    readonly DeviceOption[]
  >([defaultMicrophoneDevice]);
  const [cameraDevices, setCameraDevices] = useState<readonly DeviceOption[]>([
    defaultCameraDevice,
  ]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState("default");
  const [selectedCameraId, setSelectedCameraId] = useState("default");
  const [mirrorPreview, setMirrorPreview] = useState(true);
  const [audioUi, setAudioUi] = useState<CaptureUiState>({
    status: "idle",
    message: "No microphone active.",
  });
  const [cameraUi, setCameraUi] = useState<CaptureUiState>({
    status: "idle",
    message: "No camera active.",
  });
  const [analysisUi, setAnalysisUi] = useState<CaptureUiState>({
    status: "idle",
    message: "Video analysis off.",
  });
  const [recordingUi, setRecordingUi] = useState<CaptureUiState>({
    status: "idle",
    message: "Recording off.",
  });
  const [recordingReview, setRecordingReview] =
    useState<RecordingReviewState | null>(null);
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResult>(
    () => createTimingOnlyTranscriptResult(),
  );
  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptDirty, setTranscriptDirty] = useState(false);
  const [transcriptMessage, setTranscriptMessage] = useState(
    "Transcription has not started.",
  );
  const [transcriptReviewError, setTranscriptReviewError] = useState<
    string | null
  >(null);
  const [pendingSpeechDisclosure, setPendingSpeechDisclosure] =
    useState<PendingSpeechDisclosure>(null);
  const [speechDisclosureAccepted, setSpeechDisclosureAccepted] =
    useState(false);
  const [livePrompt, setLivePrompt] = useState<LivePrompt | null>(null);
  const [dismissedPromptIds, setDismissedPromptIds] = useState<
    readonly string[]
  >([]);
  const previousNowRef = useRef(nowMs);
  const eventCounterRef = useRef(0);
  const machineRef = useRef(machine);
  const activeCaptureRef = useRef<ActiveAnswerCapture | null>(null);
  const finalizedCaptureRef = useRef<FinalizedCapture | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const unregisterRecordingUrlRef = useRef<(() => void) | null>(null);
  const finishingRef = useRef(false);
  const suppressProgressPersistenceRef = useRef(false);
  const sessionCreatedAtRef = useRef(recoveredProgress?.createdAt ?? nowIso());
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [persistenceMessage, setPersistenceMessage] = useState(
    repositoryStatus === "unavailable"
      ? "Persistent saving unavailable. This tab still keeps a temporary checkpoint."
      : "Preparing local save…",
  );
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [explicitSaveConfirmed, setExplicitSaveConfirmed] = useState(false);
  const transcriptionSessionRef = useRef<TranscriptionSession | null>(null);
  const unregisterTranscriptionRef = useRef<(() => void) | null>(null);
  const unsubscribeTranscriptionRef = useRef<(() => void) | null>(null);
  const lastLivePromptAtRef = useRef(Number.NEGATIVE_INFINITY);

  const question = currentQuestion(machine);
  const attempts = question ? getQuestionAttempts(machine, question.id) : [];
  const activeAttempt = question
    ? attempts.find((attempt) => attempt.id === machine.activeAttemptId)
    : undefined;
  const timer = createTimerSnapshot(machine, nowMs);
  const liveMessage =
    timerLiveMessage.length > 0
      ? timerLiveMessage
      : (machine.announcements.at(-1)?.message ?? "");
  const interviewContext = useMemo(
    () =>
      toInterviewContext({
        ...draft,
        jobTitle: draft.jobTitle.trim() || "Practice interview",
      }),
    [draft],
  );
  const practiceCoaching = useMemo<PracticeCoaching | null>(() => {
    const revision = transcriptResult.activeRevision;
    if (machine.state !== "reviewing" || !question || !revision) {
      return null;
    }

    const speakingMetric = activeAttempt?.audioMetrics?.speakingDurationMs;

    return answerAnalyzer.analyzePractice({
      question,
      transcriptRevision: revision,
      locale: interviewContext.locale,
      ...(activeAttempt?.answerDurationMs !== undefined
        ? { answerDurationMs: activeAttempt.answerDurationMs }
        : {}),
      ...(speakingMetric && speakingMetric.status !== "unavailable"
        ? { speakingDurationMs: speakingMetric.value }
        : {}),
      context: interviewContext,
      ...(activeAttempt?.audioMetrics
        ? { audioMetrics: activeAttempt.audioMetrics }
        : {}),
    });
  }, [
    activeAttempt,
    answerAnalyzer,
    interviewContext,
    machine.state,
    question,
    transcriptResult.activeRevision,
  ]);

  const dispatch = useCallback((event: InterviewEventInput) => {
    eventCounterRef.current += 1;
    const nextNowMs = monotonicNowMs();
    setNowMs(nextNowMs);
    setTimerLiveMessage("");
    dispatchMachine({
      ...event,
      eventId: `${event.type}:${eventCounterRef.current}`,
      nowMs: nextNowMs,
      occurredAt: nowIso(),
    });
  }, []);

  const dispatchAt = useCallback(
    (event: InterviewEventInput, eventNowMs: number, occurredAt: string) => {
      eventCounterRef.current += 1;
      setNowMs(eventNowMs);
      setTimerLiveMessage("");
      dispatchMachine({
        ...event,
        eventId: `${event.type}:${eventCounterRef.current}`,
        nowMs: eventNowMs,
        occurredAt: isoDateTime(occurredAt),
      });
    },
    [],
  );

  useEffect(() => {
    machineRef.current = machine;
  }, [machine]);

  const discardTransientRecording = useCallback(() => {
    if (!recordingReview) {
      return;
    }

    recordingReview.handle.dispose();
    unregisterRecordingUrlRef.current?.();
    unregisterRecordingUrlRef.current = null;
    setRecordingReview(null);
    setRecordingUi({
      status: "stopped",
      message: "Recording discarded.",
    });
  }, [recordingReview]);

  const stopActiveTranscription = useCallback(
    async (preferTypedText = false): Promise<TranscriptResult> => {
      const session = transcriptionSessionRef.current;
      transcriptionSessionRef.current = null;
      unsubscribeTranscriptionRef.current?.();
      unsubscribeTranscriptionRef.current = null;
      unregisterTranscriptionRef.current?.();
      unregisterTranscriptionRef.current = null;
      if (!session) {
        return transcriptResult;
      }

      if (preferTypedText) {
        session.abort();
        return transcriptResult;
      }

      let timeoutId: number | undefined;
      try {
        const timeoutResult = new Promise<TranscriptResult>((resolve) => {
          timeoutId = window.setTimeout(() => {
            session.abort();
            resolve(transcriptResult);
          }, 1_000);
        });
        const result = await Promise.race([session.stop(), timeoutResult]);
        setTranscriptResult(result);
        setTranscriptText(
          formatTranscriptParagraphs(result.activeRevision?.text ?? ""),
        );
        setTranscriptMessage(transcriptStatusMessage(result));
        return result;
      } catch {
        session.abort();
        return transcriptResult;
      } finally {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      }
    },
    [transcriptResult],
  );

  const startActiveTranscription = useCallback(
    async (attemptId: QuestionResponseId) => {
      if (
        machineRef.current.settings.transcription !== "ask-when-supported" ||
        !speechDisclosureAccepted ||
        transcriptionSessionRef.current
      ) {
        return;
      }

      const session = await transcription.start({
        locale: interviewContext.locale,
        disclosureAccepted: true,
      });
      if (
        machineRef.current.state !== "answering" ||
        machineRef.current.activeAttemptId !== attemptId
      ) {
        session.abort();
        return;
      }

      transcriptionSessionRef.current = session;
      unregisterTranscriptionRef.current?.();
      unregisterTranscriptionRef.current = registry.register({
        id: `interview-transcription:${attemptId}`,
        dispose: () => {
          session.abort();
        },
      });
      unsubscribeTranscriptionRef.current?.();
      unsubscribeTranscriptionRef.current = session.subscribe((result) => {
        setTranscriptResult(result);
        setTranscriptText(result.activeRevision?.text ?? "");
        setTranscriptMessage(transcriptStatusMessage(result));
      });
      setTranscriptMessage(
        "Browser speech recognition active. Review its text before coaching.",
      );
    },
    [
      interviewContext.locale,
      registry,
      speechDisclosureAccepted,
      transcription,
    ],
  );

  const stopActiveCapture = useCallback(
    async (
      finishedAtMs: number,
      reason?: AvailabilityReason,
    ): Promise<FinalizedCapture | null> => {
      const capture = activeCaptureRef.current;
      if (!capture) {
        return finalizedCaptureRef.current;
      }

      activeCaptureRef.current = null;
      for (const unregister of capture.unregisters) {
        unregister();
      }

      let audioMetrics: AudioMetrics;
      if (capture.audioSession) {
        audioMetrics = await capture.audioSession.stop(finishedAtMs, reason);
      } else {
        audioMetrics = createUnavailableAudioMetrics(
          capture.audioUnavailableReason ?? "initialization-failed",
          capture.startedAtMs,
          finishedAtMs,
        );
      }

      let videoMetrics: VideoMetrics;
      if (capture.videoSession) {
        videoMetrics = await capture.videoSession.stop(finishedAtMs, reason);
      } else {
        videoMetrics = createUnavailableVideoMetrics(
          capture.videoUnavailableReason ??
            (machineRef.current.settings.cameraRequested
              ? "initialization-failed"
              : "not-requested"),
        );
      }

      if (capture.recorderSession) {
        const recordingResult =
          await capture.recorderSession.stop(finishedAtMs);
        if (recordingResult.ok) {
          unregisterRecordingUrlRef.current?.();
          const handle = createTransientRecordingReview(
            capture.attemptId,
            recordingResult.recording,
          );
          unregisterRecordingUrlRef.current = registry.register({
            id: `transient-recording-url:${capture.attemptId}`,
            dispose: () => {
              handle.dispose();
            },
          });
          setRecordingReview({
            handle,
            saveStatus: "idle",
          });
          setRecordingUi({
            status: "stopped",
            message: "Recording in memory.",
          });
        } else {
          setRecordingUi({
            status: "unavailable",
            message: recorderFailureMessage(recordingResult.code),
          });
        }
      } else if (capture.recorderFailureCode) {
        setRecordingUi({
          status: "unavailable",
          message: recorderFailureMessage(capture.recorderFailureCode),
        });
      }

      if (capture.microphoneStream) {
        mediaDevices.stopStream(capture.microphoneStream);
      }

      if (capture.cameraStream) {
        mediaDevices.stopStream(capture.cameraStream);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      const finalized = {
        attemptId: capture.attemptId,
        audioMetrics,
        videoMetrics,
      };
      finalizedCaptureRef.current = finalized;
      setAudioUi({
        status: reason ? "stopped" : "stopped",
        message: reason
          ? "Microphone stopped; audio metrics may be partial."
          : "Microphone stopped.",
      });
      setCameraUi({
        status: "stopped",
        message: capture.cameraStream ? "Camera stopped." : "No camera active.",
      });
      setAnalysisUi({
        status: "stopped",
        message: capture.videoSession
          ? "Video analysis stopped."
          : "Video analysis off.",
      });
      return finalized;
    },
    [mediaDevices, registry],
  );

  const isCurrentAnswer = useCallback((attemptId: QuestionResponseId) => {
    const latest = machineRef.current;
    return latest.state === "answering" && latest.activeAttemptId === attemptId;
  }, []);

  const startAnswerCapture = useCallback(
    async (attemptId: QuestionResponseId, startedAtMs: number) => {
      if (activeCaptureRef.current?.attemptId === attemptId) {
        return;
      }

      finalizedCaptureRef.current = null;
      const settings = machineRef.current.settings;
      const unregisters: (() => void)[] = [];
      let microphoneStream: MediaStream | undefined;
      let cameraStream: MediaStream | undefined;
      let audioSession: WebAudioMetricSession | undefined;
      let videoSession: VideoAnalysisSession | undefined;
      let recorderSession: MediaRecorderSession | undefined;
      let audioUnavailableReason: AvailabilityReason | undefined =
        settings.microphoneRequested ? undefined : "not-requested";
      let videoUnavailableReason: AvailabilityReason | undefined =
        settings.cameraRequested ? undefined : "not-requested";
      let recorderFailureCode: RecorderFailureCode | undefined;

      setAudioUi(
        settings.microphoneRequested
          ? {
              status: "starting",
              message: "Requesting microphone for audio timing.",
            }
          : {
              status: "not-requested",
              message:
                "Microphone not requested; audio timing will be marked not available.",
            },
      );
      setCameraUi(
        settings.cameraRequested
          ? {
              status: "starting",
              message: "Requesting camera for the interview preview.",
            }
          : {
              status: "not-requested",
              message: "Camera not requested.",
            },
      );
      setAnalysisUi({
        status:
          settings.cameraRequested && publicAppConfig.featureFlags.videoAnalysis
            ? "starting"
            : "not-requested",
        message:
          settings.cameraRequested && publicAppConfig.featureFlags.videoAnalysis
            ? "Video analysis will start after the camera is ready."
            : "Video analysis off.",
      });
      setRecordingUi({
        status: settings.recordingCaptureRequested
          ? "starting"
          : "not-requested",
        message: settings.recordingCaptureRequested
          ? "Recording will stay in memory after this answer."
          : "Recording off.",
      });

      if (settings.microphoneRequested) {
        const result =
          await mediaDevices.requestMicrophone(selectedMicrophoneId);
        if (!isCurrentAnswer(attemptId)) {
          if (result.ok) {
            mediaDevices.stopStream(result.stream);
          }
          return;
        }

        if (result.ok) {
          microphoneStream = result.stream;
          unregisters.push(
            registry.register({
              id: `interview-microphone-stream:${attemptId}`,
              dispose: () => {
                mediaDevices.stopStream(result.stream);
              },
            }),
          );
        } else {
          audioUnavailableReason = availabilityReasonForMediaError(
            result.error,
          );
          setAudioUi({
            status: "unavailable",
            message: audioUnavailableMessage(result.error),
          });
        }
      }

      if (settings.cameraRequested) {
        const result = await mediaDevices.requestCamera(selectedCameraId);
        if (!isCurrentAnswer(attemptId)) {
          if (result.ok) {
            mediaDevices.stopStream(result.stream);
          }
          if (microphoneStream) {
            mediaDevices.stopStream(microphoneStream);
          }
          for (const unregister of unregisters) {
            unregister();
          }
          return;
        }

        if (result.ok) {
          cameraStream = result.stream;
          if (videoRef.current) {
            videoRef.current.srcObject = result.stream;
          }
          unregisters.push(
            registry.register({
              id: `interview-camera-stream:${attemptId}`,
              dispose: () => {
                mediaDevices.stopStream(result.stream);
              },
            }),
          );
          setCameraDevices(
            filterDeviceOptions(result.devices, "camera", [
              defaultCameraDevice,
            ]),
          );
          setSelectedCameraId(selectedCameraId);
          setCameraUi({
            status: "active",
            message: "Camera active.",
          });
        } else {
          videoUnavailableReason = availabilityReasonForMediaError(
            result.error,
          );
          setCameraUi({
            status: "unavailable",
            message: cameraUnavailableMessage(result.error),
          });
          setAnalysisUi({
            status: "unavailable",
            message:
              "Video analysis unavailable because the camera is unavailable.",
          });
        }
      }

      if (settings.recordingCaptureRequested) {
        const recorderStream = createRecordingStream({
          cameraStream,
          microphoneStream,
        });
        if (recorderStream) {
          const recorder = startRecorderSession({
            stream: recorderStream,
            startedAtMs,
          });
          if (recorder.ok) {
            recorderSession = recorder.session;
            unregisters.push(
              registry.register({
                id: `interview-recorder:${attemptId}`,
                dispose: () => recorder.session.discard(),
              }),
            );
            setRecordingUi({
              status: "active",
              message: recordingActiveMessage({
                cameraStream,
                microphoneStream,
                settings,
              }),
            });
          } else {
            recorderFailureCode = recorder.code;
            setRecordingUi({
              status: "unavailable",
              message: recorderFailureMessage(recorder.code),
            });
          }
        } else {
          recorderFailureCode = "unsupported";
          setRecordingUi({
            status: "unavailable",
            message:
              "Recording could not start because no selected media device was available.",
          });
        }
      }

      if (microphoneStream) {
        const audioResult = await startAudioMetricSession({
          stream: microphoneStream,
          startedAtMs,
          nowMs: monotonicNowMs,
        });
        if (!isCurrentAnswer(attemptId)) {
          if (audioResult.ok) {
            await audioResult.session.dispose();
          }
          await recorderSession?.discard();
          mediaDevices.stopStream(microphoneStream);
          if (cameraStream) {
            mediaDevices.stopStream(cameraStream);
          }
          for (const unregister of unregisters) {
            unregister();
          }
          return;
        }

        if (audioResult.ok) {
          audioSession = audioResult.session;
          unregisters.push(
            registry.register({
              id: `interview-audio-analyzer:${attemptId}`,
              dispose: () => audioResult.session.dispose(),
            }),
          );
          setAudioUi({
            status: "active",
            message: "Microphone active.",
          });
        } else {
          audioUnavailableReason = audioResult.reason;
          setAudioUi({
            status: "unavailable",
            message:
              audioResult.reason === "unsupported"
                ? "Audio timing is not supported in this browser."
                : "Audio timing could not start. You can continue with timing-only practice.",
          });
        }
      }

      if (cameraStream && videoRef.current) {
        const videoResult = await startVideoAnalysisSession({
          videoElement: videoRef.current,
          startedAtMs,
          nowMs: monotonicNowMs,
        });
        if (!isCurrentAnswer(attemptId)) {
          if (videoResult.ok) {
            await videoResult.session.dispose();
          }
          await recorderSession?.discard();
          mediaDevices.stopStream(cameraStream);
          if (microphoneStream) {
            mediaDevices.stopStream(microphoneStream);
          }
          for (const unregister of unregisters) {
            unregister();
          }
          return;
        }

        if (videoResult.ok) {
          videoSession = videoResult.session;
          unregisters.push(
            registry.register({
              id: `interview-video-analysis:${attemptId}`,
              dispose: () => videoResult.session.dispose(),
            }),
          );
          const unsubscribe = videoResult.session.subscribe((update) => {
            setAnalysisUi(videoAnalysisUiFromUpdate(update));
          });
          unregisters.push(unsubscribe);
        } else {
          videoUnavailableReason = videoResult.reason;
          setAnalysisUi({
            status: "unavailable",
            message: videoResult.message,
          });
        }
      }

      activeCaptureRef.current = {
        attemptId,
        startedAtMs,
        microphoneStream,
        cameraStream,
        audioSession,
        videoSession,
        recorderSession,
        audioUnavailableReason,
        videoUnavailableReason,
        recorderFailureCode,
        unregisters,
      };
    },
    [
      mediaDevices,
      registry,
      isCurrentAnswer,
      selectedCameraId,
      selectedMicrophoneId,
      startAudioMetricSession,
      startRecorderSession,
      startVideoAnalysisSession,
    ],
  );

  useEffect(() => {
    if (
      machine.questions.length === 0 ||
      suppressProgressPersistenceRef.current
    ) {
      return;
    }

    const timestamp = nowIso();
    progressStore.write(
      serializeInterviewProgress(
        machine,
        timestamp,
        sessionCreatedAtRef.current,
      ),
    );

    if (repositoryStatus !== "persistent") {
      return;
    }

    const projection = projectInterviewProgress({
      state: machine,
      context: interviewContext,
      extractedKeywords: draft.extractedKeywords,
      createdAt: sessionCreatedAtRef.current,
      updatedAt: timestamp,
    });

    persistenceQueueRef.current = persistenceQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const saved = await saveInterviewProgress(repository, projection);
        setPersistenceMessage(
          saved.ok
            ? "Safe checkpoint saved on this device."
            : saved.error.code === "quota-exceeded"
              ? "Local storage is full. Export important work and remove old recordings or sessions."
              : "Automatic checkpoint could not be written. Use Save and continue to retry persistent saving.",
        );
        if (saved.ok) {
          window.dispatchEvent(new Event("fairscreen:saved-sessions-changed"));
        }
      });
  }, [
    draft.extractedKeywords,
    interviewContext,
    machine,
    progressStore,
    repository,
    repositoryStatus,
  ]);

  useEffect(() => {
    if (
      !machine.settings.microphoneRequested &&
      !machine.settings.cameraRequested
    ) {
      return;
    }

    let cancelled = false;
    void mediaDevices.enumerateDevices().then((devices) => {
      if (cancelled) {
        return;
      }
      const cameras = devices.filter((device) => device.kind === "camera");
      const microphones = devices.filter(
        (device) => device.kind === "microphone",
      );
      setCameraDevices(cameras.length > 0 ? cameras : [defaultCameraDevice]);
      setMicrophoneDevices(
        microphones.length > 0 ? microphones : [defaultMicrophoneDevice],
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    machine.settings.cameraRequested,
    machine.settings.microphoneRequested,
    mediaDevices,
  ]);

  useEffect(() => {
    previousNowRef.current = nowMs;
  }, [machine.state, machine.activeDeadlineMs, nowMs]);

  useEffect(() => {
    if (
      machine.settings.timingMode === "untimed" ||
      !["preparing", "answering"].includes(machine.state)
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const nextNow = monotonicNowMs();
      const announcements = timerAnnouncementsBetween(
        machine,
        previousNowRef.current,
        nextNow,
        nowIso(),
      );
      previousNowRef.current = nextNow;
      setNowMs(nextNow);
      const latest = announcements.at(-1);
      if (latest) {
        setTimerLiveMessage(latest.message);
      }

      const snapshot = createTimerSnapshot(machine, nextNow);
      if (
        snapshot.expired &&
        (machine.state === "preparing" ||
          machine.settings.timingMode === "strictPractice")
      ) {
        dispatch({
          type: "TIMER_EXPIRED",
        });
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [dispatch, machine]);

  useEffect(() => {
    return () => {
      void registry.disposeAll("route-change");
    };
  }, [registry]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "INPUT" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }

      if (hasInProgressWork(machine)) {
        event.preventDefault();
        setConfirmAction("exit");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [machine]);

  useEffect(() => {
    if (
      machine.state !== "answering" ||
      !machine.activeAttemptId ||
      machine.activeStartedAtMs === undefined
    ) {
      return;
    }

    void startAnswerCapture(machine.activeAttemptId, machine.activeStartedAtMs);
    void startActiveTranscription(machine.activeAttemptId);
  }, [
    machine.activeAttemptId,
    machine.activeStartedAtMs,
    machine.state,
    startActiveTranscription,
    startAnswerCapture,
  ]);

  useEffect(() => {
    return () => {
      unsubscribeTranscriptionRef.current?.();
      unsubscribeTranscriptionRef.current = null;
      unregisterTranscriptionRef.current?.();
      unregisterTranscriptionRef.current = null;
      transcriptionSessionRef.current?.abort();
      transcriptionSessionRef.current = null;
    };
  }, []);

  const livePromptCandidate = useMemo(
    () =>
      selectLivePrompt({
        machine,
        elapsedMs:
          machine.state === "answering" &&
          machine.activeStartedAtMs !== undefined
            ? Math.max(0, nowMs - machine.activeStartedAtMs)
            : 0,
        answerText: `${transcriptText} ${notes}`.trim(),
        audioUi,
        cameraUi,
      }),
    [audioUi, cameraUi, machine, notes, nowMs, transcriptText],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (
        machine.state !== "answering" ||
        machine.settings.liveCoaching === "off"
      ) {
        setLivePrompt(null);
        return;
      }
      if (
        !shouldPresentLivePrompt({
          candidate: livePromptCandidate,
          ...(livePrompt?.id ? { currentPromptId: livePrompt.id } : {}),
          dismissedPromptIds,
          lastShownAtMs: lastLivePromptAtRef.current,
          nowMs,
        }) ||
        !livePromptCandidate
      ) {
        return;
      }
      lastLivePromptAtRef.current = nowMs;
      setLivePrompt(livePromptCandidate);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    dismissedPromptIds,
    livePrompt?.id,
    livePromptCandidate,
    machine.settings.liveCoaching,
    machine.state,
    nowMs,
  ]);

  useEffect(() => {
    const stopForHiddenPage = () => {
      const latest = machineRef.current;
      if (latest.state !== "answering") {
        return;
      }

      void Promise.all([
        stopActiveCapture(monotonicNowMs(), "interrupted"),
        stopActiveTranscription(),
      ]).then(() => {
        dispatch({ type: "STOP_MEDIA" });
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopForHiddenPage();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", stopForHiddenPage);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", stopForHiddenPage);
    };
  }, [dispatch, stopActiveCapture, stopActiveTranscription]);

  if (machine.questions.length === 0) {
    return (
      <PageContainer className="page-stack interview-page">
        <PageHeader
          eyebrow="Interview"
          title="Interview practice"
          lead={
            <p>
              Generate a question set before starting the interview workflow. No
              timer, camera, microphone, recorder, or transcription starts from
              this route.
            </p>
          }
          actions={
            <LinkButton to="/interviews/new" variant="secondary">
              Return to setup
            </LinkButton>
          }
        />
      </PageContainer>
    );
  }

  function startPrep() {
    dispatch({ type: "START_PREP" });
  }

  function resetAnswerReviewState() {
    setNotes("");
    setTranscriptText("");
    setTranscriptDirty(false);
    setTranscriptReviewError(null);
    setLivePrompt(null);
    setDismissedPromptIds([]);
    lastLivePromptAtRef.current = Number.NEGATIVE_INFINITY;
    discardTransientRecording();
  }

  function beginAnswer() {
    resetAnswerReviewState();
    dispatch({ type: "START_ANSWER" });
  }

  async function startAnswer() {
    if (machine.settings.transcription === "timing-only") {
      setTranscriptResult(createTimingOnlyTranscriptResult());
      setTranscriptMessage(
        "Timing-only mode. No transcript will be generated.",
      );
      beginAnswer();
      return;
    }

    if (machine.settings.transcription === "manual") {
      setTranscriptResult(
        createTimingOnlyTranscriptResult(
          "Enter or paste a manual transcript during the answer or review.",
        ),
      );
      setTranscriptMessage("Manual transcript mode.");
      beginAnswer();
      return;
    }

    if (!machine.settings.microphoneRequested) {
      setTranscriptResult(
        createUnavailableTranscriptResult({
          providerId: "manual-transcript",
          processingMode: "device",
          safeMessage:
            "No microphone selected. Type or paste your answer instead.",
        }),
      );
      setTranscriptMessage(
        "No microphone selected. Typed answer text will be used as the transcript.",
      );
      beginAnswer();
      return;
    }

    const capability = await transcription.getCapability();
    if (
      capability.status === "unsupported" ||
      capability.status === "blocked"
    ) {
      setTranscriptResult(
        createUnavailableTranscriptResult({
          providerId: "browser-web-speech",
          processingMode: capability.processingMode,
          safeMessage: "Browser speech recognition is unavailable.",
          limitation: capability.limitations.join(" "),
        }),
      );
      setTranscriptMessage(
        "Browser recognition unavailable. You can enter a manual transcript after answering.",
      );
      beginAnswer();
      return;
    }

    if (capability.disclosureRequired && !speechDisclosureAccepted) {
      setPendingSpeechDisclosure({
        processingMode: capability.processingMode,
        limitations: capability.limitations,
      });
      return;
    }

    beginAnswer();
  }

  async function finishAnswer() {
    if (finishingRef.current || !machine.activeAttemptId) {
      return;
    }

    finishingRef.current = true;
    const attemptId = machine.activeAttemptId;
    const finishedAtMs = monotonicNowMs();
    const occurredAt = nowIso();
    const typedAnswerAvailable = notes.trim().length > 0;
    const [captureResult, stoppedTranscript] = await Promise.all([
      stopActiveCapture(finishedAtMs),
      stopActiveTranscription(typedAnswerAvailable),
    ]);
    const finalized = captureResult ?? {
      attemptId,
      audioMetrics: createUnavailableAudioMetrics(
        machine.settings.microphoneRequested
          ? "initialization-failed"
          : "not-requested",
        machine.activeStartedAtMs ?? finishedAtMs,
        finishedAtMs,
      ),
      videoMetrics: createUnavailableVideoMetrics(
        machine.settings.cameraRequested
          ? "initialization-failed"
          : "not-requested",
      ),
    };
    const finalTranscript = finalizeTranscriptForReview({
      result: stoppedTranscript,
      manualText: notes,
      attemptId,
      locale: interviewContext.locale,
      transcriptionPreference: machine.settings.transcription,
      occurredAt: isoDateTime(occurredAt),
    });
    setTranscriptResult(finalTranscript);
    setTranscriptText(finalTranscript.activeRevision?.text ?? notes.trim());
    setTranscriptDirty(false);
    setTranscriptMessage(transcriptStatusMessage(finalTranscript));
    dispatchAt({ type: "FINISH_ANSWER", notes }, finishedAtMs, occurredAt);
    if (finalized.attemptId === attemptId) {
      dispatchAt(
        {
          type: "ATTACH_AUDIO_METRICS",
          attemptId,
          audioMetrics: finalized.audioMetrics,
        },
        finishedAtMs,
        occurredAt,
      );
      dispatchAt(
        {
          type: "ATTACH_VIDEO_METRICS",
          attemptId,
          videoMetrics: finalized.videoMetrics,
        },
        finishedAtMs,
        occurredAt,
      );
    }
    finishingRef.current = false;
  }

  function confirmTranscriptReview() {
    const text = formatTranscriptParagraphs(transcriptText);
    if (!text) {
      setTranscriptReviewError(
        "Enter a transcript before requesting answer-content coaching.",
      );
      return;
    }
    const revised = reviseTranscriptResult({
      result: transcriptResult,
      revisionKey: `${machine.activeAttemptId ?? "answer"}:review:${Date.now()}`,
      createdAt: nowIso(),
      text,
      locale: interviewContext.locale,
    });
    setTranscriptResult(revised);
    setTranscriptText(revised.activeRevision?.text ?? text);
    setTranscriptDirty(false);
    setTranscriptReviewError(null);
    setTranscriptMessage("Transcript reviewed. Content coaching is ready.");
  }

  function reviewPayload() {
    const revision = transcriptResult.activeRevision;
    const candidateAnalysis = practiceCoaching?.analysis;
    const analysisMatchesRevision =
      revision?.reviewedByUser === true &&
      candidateAnalysis?.transcriptRevisionId === revision.id &&
      candidateAnalysis.transcriptDigest === revision.normalizedDigest;

    return {
      transcript: transcriptResult,
      ...(analysisMatchesRevision ? { analysis: candidateAnalysis } : {}),
    };
  }

  function canSaveReviewedAnswer() {
    if (transcriptDirty || transcriptNeedsReview(transcriptResult)) {
      setTranscriptReviewError(
        "Review and confirm the browser-generated transcript before saving content coaching.",
      );
      return false;
    }
    if (
      machine.settings.transcription !== "timing-only" &&
      !transcriptResult.activeRevision
    ) {
      setTranscriptReviewError(
        "No transcript is available. Enter one manually or continue without content analysis.",
      );
      return false;
    }
    return true;
  }

  async function persistReviewedAnswer(
    transcript: TranscriptResult,
    analysis: ReturnType<typeof reviewPayload>["analysis"],
    recording?: RecordingReference,
  ): Promise<boolean> {
    if (isSavingReview) return false;

    const latest = machineRef.current;
    const nowValue = monotonicNowMs();
    const occurredAt = nowIso();
    eventCounterRef.current += 1;
    const event: InterviewEvent = {
      type: "SAVE_REVIEW",
      notes,
      transcript,
      ...(analysis ? { analysis } : {}),
      ...(recording ? { recording } : {}),
      eventId: `SAVE_REVIEW:${eventCounterRef.current}`,
      nowMs: nowValue,
      occurredAt: isoDateTime(occurredAt),
    };
    const nextMachine = interviewReducer(latest, event);

    setIsSavingReview(true);
    setExplicitSaveConfirmed(false);
    setPersistenceMessage("Saving this answer on your device…");
    setTranscriptReviewError(null);

    const timestamp = isoDateTime(occurredAt);
    progressStore.write(
      serializeInterviewProgress(
        nextMachine,
        timestamp,
        sessionCreatedAtRef.current,
      ),
    );

    const opened = await repository.open();
    if (!opened.ok) {
      setPersistenceMessage(
        "This answer could not be written to browser storage. It remains in this tab; retry Save or export it before closing the page.",
      );
      setTranscriptReviewError(
        "FairScreen could not confirm a persistent save. Please retry.",
      );
      setIsSavingReview(false);
      return false;
    }

    const projection = projectInterviewProgress({
      state: nextMachine,
      context: interviewContext,
      extractedKeywords: draft.extractedKeywords,
      createdAt: sessionCreatedAtRef.current,
      updatedAt: timestamp,
    });

    // An explicit save must never race an older automatic checkpoint. Wait for
    // the checkpoint queue, then write and verify the reviewed answer.
    await persistenceQueueRef.current.catch(() => undefined);
    const saved = await saveInterviewProgress(repository, projection);
    if (!saved.ok) {
      setPersistenceMessage(
        saved.error.code === "quota-exceeded"
          ? "Browser storage is full. Remove old recordings or sessions, then retry Save."
          : `This answer was not saved persistently (${saved.error.operation}). It remains in this tab; retry Save before leaving.`,
      );
      setTranscriptReviewError(
        "FairScreen could not confirm a persistent save. Please retry.",
      );
      setIsSavingReview(false);
      return false;
    }

    setNowMs(nowValue);
    setTimerLiveMessage("");
    machineRef.current = nextMachine;
    dispatchMachine(event);
    setNotes("");
    discardTransientRecording();
    setPersistenceMessage("Answer saved on this device.");
    setExplicitSaveConfirmed(true);
    setIsSavingReview(false);
    window.dispatchEvent(new Event("fairscreen:saved-sessions-changed"));
    return true;
  }

  async function saveReview() {
    if (needsRecordingDecision()) {
      setRecordingPromptAction("save-review");
      return;
    }
    if (!canSaveReviewedAnswer()) return;
    const payload = reviewPayload();
    await persistReviewedAnswer(
      payload.transcript,
      payload.analysis,
      recordingReview?.savedReference,
    );
  }

  async function saveWithoutContentAnalysis() {
    setTranscriptReviewError(null);
    const fallback = createTimingOnlyTranscriptResult(
      "The user continued without a reviewed transcript or content analysis.",
    );
    setTranscriptResult(fallback);
    if (needsRecordingDecision()) {
      setRecordingPromptAction("save-review");
      return;
    }
    await persistReviewedAnswer(
      fallback,
      undefined,
      recordingReview?.savedReference,
    );
  }

  function repeatQuestion() {
    if (needsRecordingDecision()) {
      setRecordingPromptAction("repeat");
      return;
    }

    dispatch({ type: "REPEAT_QUESTION", notes, ...reviewPayload() });
    setNotes("");
    discardTransientRecording();
  }

  function skipQuestion() {
    if (machine.state === "preparing") {
      setConfirmAction("skip");
      return;
    }

    dispatch({ type: "SKIP_QUESTION" });
  }

  function requestEnd() {
    if (needsRecordingDecision()) {
      setRecordingPromptAction("end");
      return;
    }

    if (hasInProgressWork(machine)) {
      setConfirmAction("end");
      return;
    }

    dispatch({ type: "END_INTERVIEW" });
  }

  function requestExit() {
    if (needsRecordingDecision()) {
      setRecordingPromptAction("exit");
      return;
    }

    if (hasInProgressWork(machine)) {
      setConfirmAction("exit");
      return;
    }

    void registry.disposeAll("route-change");
    void navigate("/interviews/new");
  }

  function confirmDiscard() {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === "skip") {
      dispatch({ type: "SKIP_QUESTION" });
      return;
    }

    if (action === "end") {
      discardTransientRecording();
      dispatch({ type: "END_INTERVIEW", notes });
      setNotes("");
      return;
    }

    if (action === "exit") {
      discardTransientRecording();
      const safeState = recoverToSafeInterviewState(machine, {
        occurredAt: nowIso(),
      });
      progressStore.write(
        serializeInterviewProgress(
          safeState,
          nowIso(),
          sessionCreatedAtRef.current,
        ),
      );
      void registry.disposeAll("route-change");
      void navigate("/interviews/new");
    }
  }

  function handleAttemptSelection(
    questionId: InterviewQuestionId,
    attemptId: QuestionResponseId,
  ) {
    dispatch({ type: "SELECT_REPORT_ATTEMPT", questionId, attemptId });
  }

  function startAnotherInterview() {
    suppressProgressPersistenceRef.current = true;
    discardTransientRecording();
    progressStore.clear(machine.sessionId);
    void registry.disposeAll("manual-stop");
    replaceDraft(withFreshSessionSeed(draft));
    void navigate("/interviews/new");
  }

  async function stopMedia() {
    if (machine.state === "answering") {
      await stopActiveCapture(monotonicNowMs(), "interrupted");
    }
    await registry.disposeAll("manual-stop");
    dispatch({ type: "STOP_MEDIA" });
  }

  function needsRecordingDecision() {
    return Boolean(
      recordingReview &&
      recordingReview.saveStatus !== "saved" &&
      machine.state === "reviewing",
    );
  }

  async function saveTransientRecording(): Promise<RecordingReference | null> {
    if (!recordingReview) {
      return null;
    }
    if (recordingReview.savedReference) {
      return recordingReview.savedReference;
    }

    const savedAt = nowIso();
    setRecordingReview({
      ...recordingReview,
      saveStatus: "saving",
      errorMessage: undefined,
    });

    const input: SavedRecordingInput = {
      id: recordingIdForAttempt(recordingReview.handle.attemptId),
      responseId: recordingReview.handle.attemptId,
      mimeType: recordingReview.handle.mimeType,
      sizeBytes: byteCount(recordingReview.handle.blob.size),
      durationMs: milliseconds(recordingReview.handle.durationMs),
      savedByUserAt: savedAt,
      blob: recordingReview.handle.blob,
    };
    const result = await saveRecordingAfterUserChoice(input);

    if (!result.ok) {
      setRecordingReview({
        ...recordingReview,
        saveStatus: "failed",
        errorMessage: storageFailureMessage(result.error.code),
      });
      return null;
    }

    setRecordingReview({
      ...recordingReview,
      saveStatus: "saved",
      savedReference: result.value,
      errorMessage: undefined,
    });
    setRecordingUi({
      status: "stopped",
      message: "Recording saved on this device.",
    });
    return result.value;
  }

  function continueAfterRecordingDecision(
    action: RecordingPromptAction,
    recording?: RecordingReference,
  ) {
    setRecordingPromptAction(null);
    switch (action) {
      case "save-review": {
        const payload = reviewPayload();
        void persistReviewedAnswer(
          payload.transcript,
          payload.analysis,
          recording,
        );
        return;
      }
      case "repeat":
        dispatch({ type: "REPEAT_QUESTION", notes, ...reviewPayload() });
        setNotes("");
        discardTransientRecording();
        return;
      case "end":
        setConfirmAction("end");
        return;
      case "exit":
        setConfirmAction("exit");
        return;
      case null:
        return;
    }
  }

  async function saveRecordingAndContinue() {
    const action = recordingPromptAction;
    const savedReference = await saveTransientRecording();
    if (savedReference) {
      continueAfterRecordingDecision(action, savedReference);
    }
  }

  function discardRecordingAndContinue() {
    const action = recordingPromptAction;
    discardTransientRecording();
    continueAfterRecordingDecision(action);
  }

  const displayedPersistenceMessage =
    repositoryStatus === "read-only-recovery"
      ? "Saved data is open in read-only recovery mode. This tab keeps a temporary checkpoint."
      : repositoryStatus === "unavailable"
        ? "Persistent saving unavailable. This tab still keeps a temporary checkpoint."
        : repositoryStatus === "opening"
          ? "Opening local storage…"
          : persistenceMessage;

  return (
    <PageContainer className="page-stack interview-page">
      <PageHeader
        eyebrow={stateLabel(machine.state)}
        title={`Question ${machine.currentQuestionIndex + 1} of ${machine.questions.length}`}
        lead={
          <p>
            {machine.settings.timingMode === "untimed"
              ? "Untimed practice is active."
              : `${timingModeLabel(machine.settings.timingMode)} is active.`}{" "}
            Camera, microphone, local video analysis, audio timing, optional
            recording, and opt-in speech recognition run only while you are
            answering. Content coaching uses only the reviewed transcript and
            approved practice context.
          </p>
        }
        actions={
          <>
            <Button
              icon={<Square aria-hidden="true" size={18} />}
              onClick={() => void stopMedia()}
              type="button"
              variant="danger"
            >
              Stop media
            </Button>
            <Button
              icon={<LogOut aria-hidden="true" size={18} />}
              onClick={requestExit}
              type="button"
              variant="secondary"
            >
              Exit
            </Button>
          </>
        }
      />

      <p aria-live="polite" className="visually-hidden">
        {liveMessage}
      </p>

      <section className="interview-status" aria-label="Interview status">
        <Status tone={machine.state === "complete" ? "success" : "info"}>
          {stateLabel(machine.state)}
        </Status>
        <p>
          Progress: {completedQuestionCount(machine)} of{" "}
          {machine.questions.length} questions saved or skipped.
        </p>
        <div className="media-status-row" aria-label="Media status">
          <Status tone={audioUi.status === "active" ? "success" : "info"}>
            {audioUi.message}
          </Status>
          <Status tone={cameraUi.status === "active" ? "success" : "info"}>
            {cameraUi.message}
          </Status>
          <Status tone={analysisUi.status === "active" ? "success" : "info"}>
            {analysisUi.message}
          </Status>
          <Status tone={recordingUi.status === "active" ? "warning" : "info"}>
            {recordingUi.message}
          </Status>
          <Status
            tone={
              transcriptResult.status === "complete" ||
              transcriptResult.status === "manual"
                ? "success"
                : "info"
            }
          >
            {transcriptMessage}
          </Status>
        </div>
        <Status
          tone={
            displayedPersistenceMessage.startsWith("Safe checkpoint")
              ? "success"
              : displayedPersistenceMessage.includes("full") ||
                  displayedPersistenceMessage.includes("could not")
                ? "warning"
                : "info"
          }
        >
          {displayedPersistenceMessage}
        </Status>
        {machine.settings.recordingCaptureRequested ? (
          <p className="field-help">
            Recording is enabled for capture only. Completed audio or video
            recordings stay in memory until you choose "Save recording on this
            device."
          </p>
        ) : null}
        <label className="check-control">
          <input
            checked={machine.timerAnnouncementsEnabled}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              dispatch({
                type: "SET_TIMER_ANNOUNCEMENTS",
                enabled: event.target.checked,
              });
            }}
            type="checkbox"
          />
          <span>Announce timer thresholds</span>
        </label>
      </section>

      <div className="interview-workspace">
        <section className="interview-main" aria-labelledby="question-title">
          <div className="question-panel">
            <p className="eyebrow">{question?.category}</p>
            <h2 id="question-title">{question?.text}</h2>
            <p className="field-help">
              Difficulty: {question?.difficulty}. Source: {question?.source}.
            </p>
          </div>

          {machine.settings.cameraRequested &&
          ["ready", "preparing"].includes(machine.state) ? (
            <div className="field compact-field">
              <label htmlFor="interview-camera">Camera for answering</label>
              <select
                id="interview-camera"
                onChange={(event) => {
                  setSelectedCameraId(event.target.value);
                }}
                value={selectedCameraId}
              >
                {cameraDevices.map((device) => (
                  <option
                    key={`${device.kind}-${device.deviceId}`}
                    value={device.deviceId}
                  >
                    {device.label}
                  </option>
                ))}
              </select>
              <p className="field-help">
                FairScreen asks for this camera only when you start answering.
              </p>
            </div>
          ) : null}

          {machine.settings.microphoneRequested &&
          ["ready", "preparing"].includes(machine.state) ? (
            <div className="field compact-field">
              <label htmlFor="interview-microphone">
                Microphone for audio timing
              </label>
              <select
                id="interview-microphone"
                onChange={(event) => {
                  setSelectedMicrophoneId(event.target.value);
                }}
                value={selectedMicrophoneId}
              >
                {microphoneDevices.map((device) => (
                  <option
                    key={`${device.kind}-${device.deviceId}`}
                    value={device.deviceId}
                  >
                    {device.label}
                  </option>
                ))}
              </select>
              <p className="field-help">
                FairScreen asks for this microphone only when you start
                answering.
              </p>
            </div>
          ) : null}

          {timer.visible ? (
            <div className="timer-panel" aria-label="Timer">
              <p>{timer.modeLabel}</p>
              <strong>{timer.label}</strong>
              {timer.expired && machine.settings.timingMode === "flexible" ? (
                <Status tone="warning">
                  Target time reached. Finish when you are ready.
                </Status>
              ) : null}
              {machine.settings.timingMode === "strictPractice" &&
              timer.remainingMs !== undefined &&
              timer.remainingMs <= 20_000 &&
              machine.state === "answering" ? (
                <Status tone="warning">
                  20 seconds remaining. Add time if you need it.
                </Status>
              ) : null}
            </div>
          ) : (
            <div className="timer-panel" aria-label="Timer">
              <p>Untimed</p>
              <strong>No countdown</strong>
            </div>
          )}

          {machine.state === "answering" && livePrompt ? (
            <LivePromptCard
              prompt={livePrompt}
              onDismiss={() => {
                setDismissedPromptIds((current) => [...current, livePrompt.id]);
                setLivePrompt(null);
              }}
            />
          ) : null}

          <StateControls
            canExtend={
              machine.settings.timingMode !== "untimed" &&
              !machine.extensionUsed &&
              ["preparing", "answering"].includes(machine.state)
            }
            isSavingReview={isSavingReview}
            machine={machine}
            onEnd={requestEnd}
            onExtend={() => {
              dispatch({ type: "EXTEND_TIME" });
            }}
            onFinish={() => {
              void finishAnswer();
            }}
            onNext={() => {
              dispatch({ type: "NEXT_QUESTION" });
            }}
            onRepeat={repeatQuestion}
            onSave={() => {
              void saveReview();
            }}
            onSkip={skipQuestion}
            onStartAnother={startAnotherInterview}
            onStartAnswer={() => {
              void startAnswer();
            }}
            onStartPrep={startPrep}
          />

          {machine.state === "answering" ? (
            <div className="field">
              <label htmlFor="manual-answer">Answer text</label>
              <textarea
                id="manual-answer"
                onChange={(event) => {
                  setNotes(event.target.value);
                }}
                rows={6}
                value={notes}
              />
              <p className="field-help">
                This text stays on this device. If you type or paste an answer,
                it becomes the transcript and takes priority over browser speech
                recognition.
              </p>
            </div>
          ) : null}

          {machine.state === "reviewing" ? (
            <>
              <PracticeTakeaway coaching={practiceCoaching} />
              <TranscriptReview
                dirty={transcriptDirty}
                error={transcriptReviewError}
                onChange={(value) => {
                  setTranscriptText(value);
                  setTranscriptDirty(true);
                  setTranscriptReviewError(null);
                }}
                onConfirm={confirmTranscriptReview}
                onContinueWithoutAnalysis={saveWithoutContentAnalysis}
                result={transcriptResult}
                text={transcriptText}
              />
              <PracticeCoachingDetails coaching={practiceCoaching} />
              <details className="technical-details">
                <summary>Delivery observations and technical details</summary>
                <DeliveryObservations coaching={practiceCoaching} />
                <AudioMeasurementReview
                  audioMetrics={activeAttempt?.audioMetrics}
                />
                <VideoMeasurementReview
                  videoMetrics={activeAttempt?.videoMetrics}
                />
              </details>
              <RecordingReview
                onDiscard={discardTransientRecording}
                onSave={() => {
                  void saveTransientRecording();
                }}
                recordingReview={recordingReview}
              />
            </>
          ) : null}

          {machine.state === "betweenQuestions" ? (
            <Notice
              title={
                explicitSaveConfirmed
                  ? "Answer saved on this device"
                  : "Answer ready"
              }
              variant="privacy"
            >
              <p>The next question is ready when you are.</p>
            </Notice>
          ) : null}

          {machine.state === "complete" ? (
            <Notice title="Practice complete" variant="privacy">
              <p>
                Attempts are available for user selection. FairScreen provides
                practice feedback, not a hiring score, rank, or recommendation.
              </p>
            </Notice>
          ) : null}
        </section>

        <aside className="interview-side" aria-label="Preview and attempts">
          <section className="preview-card" aria-labelledby="preview-title">
            <div className="section-heading">
              <h2 id="preview-title">Preview</h2>
              <p>
                Camera preview appears only while answering when camera is
                selected.
              </p>
            </div>
            <div className="interview-preview">
              <video
                aria-hidden={
                  machine.previewHidden || !machine.settings.cameraRequested
                }
                autoPlay
                className={[
                  "interview-preview__video",
                  mirrorPreview ? "mirror" : "",
                  machine.previewHidden ? "is-hidden" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                muted
                playsInline
                ref={videoRef}
              />
              {machine.previewHidden ? (
                <div className="interview-preview__overlay">
                  <EyeOff aria-hidden="true" size={32} />
                  <p>Preview hidden</p>
                </div>
              ) : cameraUi.status === "active" ? null : (
                <div className="interview-preview__overlay">
                  <Video aria-hidden="true" size={32} />
                  <p>
                    {machine.settings.cameraRequested
                      ? "Camera starts when you answer"
                      : "No camera selected"}
                  </p>
                </div>
              )}
            </div>
            <div className="preview-controls">
              <Button
                icon={
                  machine.previewHidden ? (
                    <Eye aria-hidden="true" size={18} />
                  ) : (
                    <EyeOff aria-hidden="true" size={18} />
                  )
                }
                onClick={() => {
                  dispatch({ type: "TOGGLE_PREVIEW" });
                }}
                type="button"
                variant="secondary"
              >
                {machine.previewHidden ? "Show my preview" : "Hide my preview"}
              </Button>
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
          </section>

          <AttemptSelector
            attempts={attempts}
            machine={machine}
            onSelect={handleAttemptSelection}
            questionId={question?.id ?? undefined}
          />
        </aside>
      </div>

      {pendingSpeechDisclosure ? (
        <SpeechDisclosureDialog
          disclosure={pendingSpeechDisclosure}
          onAccept={() => {
            setSpeechDisclosureAccepted(true);
            setPendingSpeechDisclosure(null);
            setTranscriptResult(createTimingOnlyTranscriptResult());
            setTranscriptMessage(
              "Speech recognition will start with the answer.",
            );
            beginAnswer();
          }}
          onDecline={() => {
            setSpeechDisclosureAccepted(false);
            setPendingSpeechDisclosure(null);
            setTranscriptResult(
              createUnavailableTranscriptResult({
                providerId: "browser-web-speech",
                processingMode: pendingSpeechDisclosure.processingMode,
                safeMessage: "Speech recognition was declined.",
                limitation:
                  "You can enter a manual transcript after answering.",
              }),
            );
            setTranscriptMessage(
              "Speech recognition declined. Manual transcript remains available.",
            );
            beginAnswer();
          }}
        />
      ) : null}

      {confirmAction ? (
        <ConfirmationDialog
          action={confirmAction}
          onCancel={() => {
            setConfirmAction(null);
          }}
          onConfirm={confirmDiscard}
        />
      ) : null}

      {recordingPromptAction && recordingReview ? (
        <RecordingDecisionDialog
          onCancel={() => {
            setRecordingPromptAction(null);
          }}
          onDiscard={discardRecordingAndContinue}
          onSave={() => {
            void saveRecordingAndContinue();
          }}
          recordingReview={recordingReview}
        />
      ) : null}
    </PageContainer>
  );
}

function LivePromptCard({
  onDismiss,
  prompt,
}: {
  readonly onDismiss: () => void;
  readonly prompt: LivePrompt;
}) {
  return (
    <section
      aria-label="Live coaching prompt"
      aria-live="polite"
      className={`live-prompt-card live-prompt-card--${prompt.kind}`}
      role="status"
    >
      <div>
        <p className="eyebrow">
          {prompt.kind === "delivery" ? "Delivery prompt" : "Answer prompt"}
        </p>
        <p>{prompt.text}</p>
      </div>
      <Button
        aria-label="Dismiss live prompt"
        icon={<X aria-hidden="true" size={18} />}
        onClick={onDismiss}
        type="button"
        variant="quiet"
      >
        Dismiss
      </Button>
    </section>
  );
}

function PracticeTakeaway({
  coaching,
}: {
  readonly coaching: PracticeCoaching | null;
}) {
  return (
    <section
      className="coaching-panel coaching-panel--takeaway"
      aria-labelledby="takeaway-title"
    >
      <div className="section-heading">
        <h2 id="takeaway-title">Overall practice takeaway</h2>
        <p>
          Question-aware feedback from the reviewed transcript. This is not a
          hiring assessment.
        </p>
      </div>
      {coaching ? (
        <>
          <Status
            tone={
              coaching.status === "ready"
                ? "success"
                : coaching.status === "insufficient-content"
                  ? "warning"
                  : "info"
            }
          >
            {coaching.overallTakeaway}
          </Status>
          <p>{coaching.answerSummary}</p>
        </>
      ) : (
        <Status tone="info">
          Add and review a transcript to receive answer-content coaching.
        </Status>
      )}
    </section>
  );
}

function TranscriptReview({
  dirty,
  error,
  onChange,
  onConfirm,
  onContinueWithoutAnalysis,
  result,
  text,
}: {
  readonly dirty: boolean;
  readonly error: string | null;
  readonly onChange: (value: string) => void;
  readonly onConfirm: () => void;
  readonly onContinueWithoutAnalysis: () => void;
  readonly result: TranscriptResult;
  readonly text: string;
}) {
  const needsConfirmation = dirty || transcriptNeedsReview(result);
  const generatedRevision = result.revisions.find(
    (revision) => revision.source === "browser-speech",
  );

  return (
    <section
      className="transcript-review-panel"
      aria-labelledby="transcript-title"
    >
      <div className="section-heading">
        <h2 id="transcript-title">Transcript</h2>
        <p>
          Source: {transcriptSourceLabel(result)}. Review recognition errors
          before content coaching.
        </p>
      </div>
      <div className="field">
        <label htmlFor="reviewed-transcript">Editable transcript</label>
        <textarea
          id="reviewed-transcript"
          onChange={(event) => {
            onChange(event.target.value);
          }}
          rows={10}
          value={text}
        />
        <p className="field-help">
          Browser-generated text and your reviewed revision are kept as separate
          revisions. Camera frames and recordings are never used for content
          analysis.
        </p>
      </div>
      {generatedRevision ? (
        <details>
          <summary>Original browser-generated transcript</summary>
          <p>{generatedRevision.text || "No text was recognized."}</p>
        </details>
      ) : null}
      {error ? <Status tone="warning">{error}</Status> : null}
      <div className="action-row">
        <Button
          disabled={!text.trim() || !needsConfirmation}
          onClick={onConfirm}
          type="button"
          variant="secondary"
        >
          {needsConfirmation
            ? "Confirm transcript review"
            : "Transcript reviewed"}
        </Button>
        {!result.activeRevision || error ? (
          <Button
            onClick={onContinueWithoutAnalysis}
            type="button"
            variant="quiet"
          >
            Continue without content analysis
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function PracticeCoachingDetails({
  coaching,
}: {
  readonly coaching: PracticeCoaching | null;
}) {
  if (!coaching || coaching.status === "transcript-required") {
    return null;
  }

  return (
    <div className="coaching-sections">
      <section className="coaching-panel" aria-labelledby="worked-title">
        <h2 id="worked-title">What worked</h2>
        {coaching.whatWorked.length > 0 ? (
          <ul>
            {coaching.whatWorked.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>
            There was not enough meaningful content to identify a reliable
            strength. FairScreen will not manufacture praise for filler or
            silence.
          </p>
        )}
      </section>

      <section className="coaching-panel" aria-labelledby="improve-title">
        <h2 id="improve-title">What to improve</h2>
        <ul>
          {coaching.whatToImprove.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="coaching-panel" aria-labelledby="stronger-title">
        <h2 id="stronger-title">Suggested stronger answer</h2>
        <ParagraphText text={coaching.suggestedStrongerAnswer} />
      </section>

      <section className="coaching-panel" aria-labelledby="follow-up-title">
        <h2 id="follow-up-title">Likely follow-up questions</h2>
        {coaching.followUpQuestions.length > 0 ? (
          <ol>
            {coaching.followUpQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
        ) : (
          <p>
            Follow-up questions appear after substantive content is reviewed.
          </p>
        )}
      </section>

      <section
        className="coaching-panel coaching-panel--next"
        aria-labelledby="next-action-title"
      >
        <h2 id="next-action-title">Try this next</h2>
        <p>{coaching.tryThisNext}</p>
      </section>
    </div>
  );
}

function DeliveryObservations({
  coaching,
}: {
  readonly coaching: PracticeCoaching | null;
}) {
  return (
    <section className="delivery-observations" aria-labelledby="delivery-title">
      <h2 id="delivery-title">Delivery observations</h2>
      {coaching?.deliveryObservations.length ? (
        <ul>
          {coaching.deliveryObservations.map((observation) => (
            <li key={observation}>{observation}</li>
          ))}
        </ul>
      ) : (
        <p>No transcript-based delivery observation is available.</p>
      )}
      <p className="field-help">
        These observations concern recording conditions and timing only. They do
        not infer emotion, personality, confidence, honesty, identity,
        disability, accent quality, or hiring suitability.
      </p>
    </section>
  );
}

function ParagraphText({ text }: { readonly text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return (
    <div className="paragraph-text">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}:${paragraph.slice(0, 32)}`}>{paragraph}</p>
      ))}
    </div>
  );
}

function SpeechDisclosureDialog({
  disclosure,
  onAccept,
  onDecline,
}: {
  readonly disclosure: Exclude<PendingSpeechDisclosure, null>;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}) {
  return (
    <div className="dialog-backdrop">
      <section
        aria-labelledby="speech-disclosure-title"
        aria-modal="true"
        className="confirm-dialog"
        role="dialog"
      >
        <h2 id="speech-disclosure-title">Use browser speech recognition?</h2>
        <p>
          The browser may process microphone speech on this device or through a
          browser/vendor service. FairScreen cannot verify the processing mode.
        </p>
        <ul>
          {disclosure.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
        <p className="field-help">
          FairScreen does not send camera frames, recordings, résumé data, job
          data, or company research to the browser speech-recognition service.
        </p>
        <div className="action-row">
          <Button onClick={onAccept} type="button">
            Accept and start answer
          </Button>
          <Button onClick={onDecline} type="button" variant="secondary">
            Continue without speech recognition
          </Button>
        </div>
      </section>
    </div>
  );
}

function StateControls({
  canExtend,
  isSavingReview,
  machine,
  onEnd,
  onExtend,
  onFinish,
  onNext,
  onRepeat,
  onSave,
  onSkip,
  onStartAnother,
  onStartAnswer,
  onStartPrep,
}: {
  readonly canExtend: boolean;
  readonly isSavingReview: boolean;
  readonly machine: InterviewMachineState;
  readonly onEnd: () => void;
  readonly onExtend: () => void;
  readonly onFinish: () => void;
  readonly onNext: () => void;
  readonly onRepeat: () => void;
  readonly onSave: () => void;
  readonly onSkip: () => void;
  readonly onStartAnother: () => void;
  readonly onStartAnswer: () => void;
  readonly onStartPrep: () => void;
}) {
  return (
    <div className="interview-controls" aria-label="Interview controls">
      {machine.state === "ready" ? (
        <>
          <Button
            icon={<Play aria-hidden="true" size={18} />}
            onClick={onStartPrep}
          >
            Start preparation
          </Button>
          <Button
            icon={<SkipForward aria-hidden="true" size={18} />}
            onClick={onSkip}
            variant="secondary"
          >
            Skip question
          </Button>
          <Button onClick={onEnd} type="button" variant="quiet">
            End practice
          </Button>
        </>
      ) : null}

      {machine.state === "preparing" ? (
        <>
          <Button
            icon={<Play aria-hidden="true" size={18} />}
            onClick={onStartAnswer}
          >
            Start answer now
          </Button>
          <Button
            disabled={!canExtend}
            icon={<Plus aria-hidden="true" size={18} />}
            onClick={onExtend}
            variant="secondary"
          >
            Extend time
          </Button>
          <Button
            icon={<SkipForward aria-hidden="true" size={18} />}
            onClick={onSkip}
            variant="secondary"
          >
            Skip question
          </Button>
          <Button onClick={onEnd} type="button" variant="quiet">
            End practice
          </Button>
        </>
      ) : null}

      {machine.state === "answering" ? (
        <>
          <Button
            icon={<Square aria-hidden="true" size={18} />}
            onClick={onFinish}
          >
            Finish answer
          </Button>
          <Button
            disabled={!canExtend}
            icon={<Plus aria-hidden="true" size={18} />}
            onClick={onExtend}
            variant="secondary"
          >
            Extend time
          </Button>
          <Button onClick={onEnd} type="button" variant="quiet">
            End practice
          </Button>
        </>
      ) : null}

      {machine.state === "reviewing" ? (
        <>
          <Button
            disabled={isSavingReview}
            icon={<ChevronRight aria-hidden="true" size={18} />}
            onClick={onSave}
          >
            {isSavingReview ? "Saving…" : "Save and continue"}
          </Button>
          <Button
            icon={<RotateCcw aria-hidden="true" size={18} />}
            onClick={onRepeat}
            variant="secondary"
          >
            Repeat this question
          </Button>
          <Button onClick={onEnd} type="button" variant="quiet">
            End practice
          </Button>
        </>
      ) : null}

      {machine.state === "betweenQuestions" ? (
        <>
          <Button
            icon={<ChevronRight aria-hidden="true" size={18} />}
            onClick={onNext}
          >
            Next question
          </Button>
          <Button onClick={onEnd} type="button" variant="quiet">
            End practice
          </Button>
        </>
      ) : null}

      {machine.state === "complete" ? (
        <>
          <LinkButton
            icon={<FileText aria-hidden="true" size={18} />}
            to={interviewSessionPath(machine.sessionId, "report")}
          >
            View report
          </LinkButton>
          <Button onClick={onStartAnother} type="button" variant="secondary">
            Start another interview
          </Button>
        </>
      ) : null}
    </div>
  );
}

function AudioMeasurementReview({
  audioMetrics,
}: {
  readonly audioMetrics: AudioMetrics | undefined;
}) {
  if (!audioMetrics) {
    return (
      <section className="measurement-panel" aria-labelledby="audio-title">
        <div className="section-heading">
          <h2 id="audio-title">What was measured</h2>
          <p>Audio timing is finalizing.</p>
        </div>
      </section>
    );
  }

  if (audioMetrics.status === "unavailable") {
    const reason =
      audioMetrics.speakingDurationMs.status === "unavailable"
        ? audioMetrics.speakingDurationMs.reason
        : "insufficient-samples";
    return (
      <section className="measurement-panel" aria-labelledby="audio-title">
        <div className="section-heading">
          <h2 id="audio-title">Delivery observations</h2>
          <p>Audio timing could not produce reliable delivery measurements.</p>
        </div>
        <Status tone="info">{availabilityAction(reason, "audio")}</Status>
        {audioMetrics.answerDurationMs.status !== "unavailable" ? (
          <p>
            Answer duration:{" "}
            {formatDuration(audioMetrics.answerDurationMs.value)}.
          </p>
        ) : null}
        <details className="disclosure">
          <summary className="disclosure__summary">
            Audio calculation details
          </summary>
          <div className="disclosure__body">
            <p>Algorithm: {audioMetrics.algorithmVersion}</p>
            {audioMetrics.speakingDurationMs.limitations.map((limitation) => (
              <p key={limitation}>{limitation}</p>
            ))}
          </div>
        </details>
      </section>
    );
  }

  const rows = [
    {
      label: "Answer duration",
      value: metricText(audioMetrics.answerDurationMs, formatDuration),
    },
    {
      label: "Delay before detected speech",
      value: metricText(audioMetrics.delayBeforeSpeechMs, formatDuration),
    },
    {
      label: "Approximate speaking time",
      value: metricText(audioMetrics.speakingDurationMs, formatDuration),
    },
    {
      label: "Approximate silence time",
      value: metricText(audioMetrics.silenceDurationMs, formatDuration),
    },
    {
      label: "Longest internal silence",
      value: metricText(audioMetrics.longestInternalSilenceMs, formatDuration),
    },
    {
      label: "Average captured microphone level",
      value: metricText(
        audioMetrics.averageMicrophoneLevelDbfs,
        (value) => `${value.toFixed(1)} dBFS`,
      ),
    },
    {
      label: "Peak captured microphone level",
      value: metricText(
        audioMetrics.peakMicrophoneLevelDbfs,
        (value) => `${value.toFixed(1)} dBFS`,
      ),
    },
    {
      label: "Approximate words per minute",
      value: metricText(
        audioMetrics.approximateWordsPerMinute,
        (value) => `${value.toFixed(1)} words per minute`,
      ),
    },
  ];

  return (
    <section className="measurement-panel" aria-labelledby="audio-title">
      <div className="section-heading">
        <h2 id="audio-title">What was measured</h2>
        <p>
          Audio observations describe captured timing and signal levels only.
        </p>
      </div>
      <dl className="measurement-list">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="field-help">
        These estimates depend on your microphone, room, browser, and reviewed
        text. They describe setup and timing only.
      </p>
      <details className="disclosure">
        <summary className="disclosure__summary">
          Audio calculation details
        </summary>
        <div className="disclosure__body">
          <p>Algorithm: {audioMetrics.algorithmVersion}</p>
          <p>
            Samples: {audioMetrics.sampleCount}; invalid windows:{" "}
            {audioMetrics.invalidSampleCount}.
          </p>
          {audioMetrics.calibration ? (
            <p>
              Noise floor {audioMetrics.calibration.noiseFloorDbfs.toFixed(1)}{" "}
              dBFS; threshold{" "}
              {audioMetrics.calibration.speechThresholdDbfs.toFixed(1)} dBFS;{" "}
              calibration {audioMetrics.calibration.calibrationQuality}.
            </p>
          ) : null}
          {audioMetrics.warnings.length > 0 ? (
            <ul className="plain-list">
              {audioMetrics.warnings.map((warning) => (
                <li key={warning}>{audioWarningLabel(warning)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function VideoMeasurementReview({
  videoMetrics,
}: {
  readonly videoMetrics: VideoMetrics | undefined;
}) {
  if (!videoMetrics) {
    return (
      <section className="measurement-panel" aria-labelledby="video-title">
        <div className="section-heading">
          <h2 id="video-title">Video conditions</h2>
          <p>Video condition metrics are finalizing.</p>
        </div>
      </section>
    );
  }

  if (videoMetrics.status === "unavailable") {
    const reason =
      videoMetrics.faceDetectionPercentage.status === "unavailable"
        ? videoMetrics.faceDetectionPercentage.reason
        : "insufficient-samples";
    return (
      <section className="measurement-panel" aria-labelledby="video-title">
        <div className="section-heading">
          <h2 id="video-title">Video conditions</h2>
          <p>No reliable video-condition sample was available.</p>
        </div>
        <Status tone="info">{availabilityAction(reason, "video")}</Status>
        <p className="field-help">
          This does not affect transcript coaching or the saved answer content.
        </p>
        <details className="disclosure">
          <summary className="disclosure__summary">
            Video calculation details
          </summary>
          <div className="disclosure__body">
            <p>Algorithm: {videoMetrics.algorithmVersion}</p>
            {videoMetrics.faceDetectionPercentage.limitations.map(
              (limitation) => (
                <p key={limitation}>{limitation}</p>
              ),
            )}
          </div>
        </details>
      </section>
    );
  }

  const rows = [
    {
      label: "Face-like shape detected",
      value: metricText(videoMetrics.faceDetectionPercentage, formatPercentage),
    },
    {
      label: "Single face-like shape",
      value: metricText(videoMetrics.singleFacePercentage, formatPercentage),
    },
    {
      label: "Multiple face-like shapes",
      value: metricText(videoMetrics.multipleFacePercentage, formatPercentage),
    },
    {
      label: "Broad centre guide",
      value: metricText(
        videoMetrics.reasonableCentringPercentage,
        formatPercentage,
      ),
    },
    {
      label: "Near-camera orientation",
      value: metricText(
        videoMetrics.nearCameraOrientationPercentage,
        formatPercentage,
      ),
    },
    {
      label: "Framing",
      value: distributionText(videoMetrics.framing),
    },
    {
      label: "Lighting",
      value: distributionText(videoMetrics.brightness),
    },
  ];

  return (
    <section className="measurement-panel" aria-labelledby="video-title">
      <div className="section-heading">
        <h2 id="video-title">Video conditions</h2>
        <p>
          Visual measurements are provided only to help describe video-call
          conditions.
        </p>
      </div>
      <dl className="measurement-list">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="field-help">
        These observations never affect answer content analysis and should not
        be interpreted as competence, confidence, honesty, identity, emotion, or
        suitability.
      </p>
      <details className="disclosure">
        <summary className="disclosure__summary">
          Video calculation details
        </summary>
        <div className="disclosure__body">
          <p>Algorithm: {videoMetrics.algorithmVersion}</p>
          <p>Model: {videoMetrics.modelVersion}</p>
          <p>
            Frames processed: {videoMetrics.processedFrameCount}; dropped:{" "}
            {videoMetrics.droppedFrameCount}; invalid:{" "}
            {videoMetrics.invalidFrameCount}. Target sample rate:{" "}
            {videoMetrics.targetSampleRateHz} fps.
          </p>
          {videoMetrics.warnings.length > 0 ? (
            <ul className="plain-list">
              {videoMetrics.warnings.map((warning) => (
                <li key={warning}>{videoWarningLabel(warning)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function RecordingReview({
  onDiscard,
  onSave,
  recordingReview,
}: {
  readonly onDiscard: () => void;
  readonly onSave: () => void;
  readonly recordingReview: RecordingReviewState | null;
}) {
  if (!recordingReview) {
    return null;
  }

  const isVideoRecording = recordingReview.handle.mimeType.startsWith("video/");

  return (
    <section className="recording-panel" aria-labelledby="recording-title">
      <div className="section-heading">
        <h2 id="recording-title">Recording</h2>
        <p>Saved only when you choose to keep it on this device.</p>
      </div>
      {isVideoRecording ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- The reviewed transcript is displayed separately; browser MediaRecorder cannot attach it as a timed caption track.
        <video
          aria-label="Captured answer video recording"
          controls
          src={recordingReview.handle.objectUrl}
        />
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- The reviewed transcript is displayed separately; browser MediaRecorder cannot attach it as a timed caption track.
        <audio
          aria-label="Captured answer audio recording"
          controls
          src={recordingReview.handle.objectUrl}
        />
      )}
      <p>
        Format: {recordingReview.handle.mimeType}. Size:{" "}
        {formatBytes(recordingReview.handle.sizeBytes)}. Duration:{" "}
        {formatDuration(recordingReview.handle.durationMs)}.
      </p>
      <p className="field-help">
        Other people using this browser profile may be able to open saved data.
      </p>
      {recordingReview.handle.warnings.length > 0 ? (
        <Status tone="warning">
          {recordingReview.handle.warnings.join(" ")}
        </Status>
      ) : null}
      {recordingReview.errorMessage ? (
        <Status tone="warning">{recordingReview.errorMessage}</Status>
      ) : null}
      {recordingReview.saveStatus === "saved" ? (
        <Status tone="success">Recording saved on this device.</Status>
      ) : null}
      <div className="action-row">
        <Button
          disabled={
            recordingReview.saveStatus === "saving" ||
            recordingReview.saveStatus === "saved"
          }
          icon={<Save aria-hidden="true" size={18} />}
          onClick={onSave}
          type="button"
          variant="secondary"
        >
          {recordingReview.saveStatus === "saving"
            ? "Saving recording"
            : "Save recording on this device"}
        </Button>
        <Button
          disabled={recordingReview.saveStatus === "saving"}
          icon={<Trash2 aria-hidden="true" size={18} />}
          onClick={onDiscard}
          type="button"
          variant="quiet"
        >
          Discard recording
        </Button>
      </div>
    </section>
  );
}

function RecordingDecisionDialog({
  onCancel,
  onDiscard,
  onSave,
  recordingReview,
}: {
  readonly onCancel: () => void;
  readonly onDiscard: () => void;
  readonly onSave: () => void;
  readonly recordingReview: RecordingReviewState;
}) {
  return (
    <div className="dialog-backdrop">
      <section
        aria-labelledby="recording-decision-title"
        aria-modal="true"
        className="confirm-dialog"
        role="dialog"
      >
        <h2 id="recording-decision-title">Save or discard recording?</h2>
        <p>
          This recording is still only in memory. It will not be saved unless
          you choose "Save recording on this device."
        </p>
        {recordingReview.errorMessage ? (
          <Status tone="warning">
            {recordingReview.errorMessage} The in-memory recording is still
            available while this page is open.
          </Status>
        ) : null}
        <div className="action-row">
          <Button
            disabled={recordingReview.saveStatus === "saving"}
            icon={<Save aria-hidden="true" size={18} />}
            onClick={onSave}
            type="button"
          >
            {recordingReview.saveStatus === "saving"
              ? "Saving recording"
              : "Save recording on this device"}
          </Button>
          <Button
            disabled={recordingReview.saveStatus === "saving"}
            icon={<Trash2 aria-hidden="true" size={18} />}
            onClick={onDiscard}
            type="button"
            variant={
              recordingReview.saveStatus === "failed" ? "secondary" : "danger"
            }
          >
            {recordingReview.saveStatus === "failed"
              ? "Save answer without recording"
              : "Discard recording"}
          </Button>
          <Button onClick={onCancel} type="button" variant="secondary">
            Keep reviewing
          </Button>
        </div>
      </section>
    </div>
  );
}

function AttemptSelector({
  attempts,
  machine,
  onSelect,
  questionId,
}: {
  readonly attempts: ReturnType<typeof getQuestionAttempts>;
  readonly machine: InterviewMachineState;
  readonly onSelect: (
    questionId: InterviewQuestionId,
    attemptId: QuestionResponseId,
  ) => void;
  readonly questionId: InterviewQuestionId | undefined;
}) {
  if (!questionId || attempts.length === 0) {
    return (
      <section className="attempt-panel" aria-labelledby="attempts-title">
        <h2 id="attempts-title">Attempts</h2>
        <p>No attempts yet.</p>
      </section>
    );
  }

  return (
    <section className="attempt-panel" aria-labelledby="attempts-title">
      <h2 id="attempts-title">Attempts</h2>
      <p className="field-help">
        Choose the attempt that should appear in reports. FairScreen does not
        choose one automatically.
      </p>
      <fieldset className="radio-group">
        <legend>Report attempt selection</legend>
        {attempts.map((attempt) => (
          <label className="segmented-control__item" key={attempt.id}>
            <input
              checked={
                machine.selectedAttemptByQuestion[questionId] === attempt.id
              }
              name={`attempt-${questionId}`}
              onChange={() => {
                onSelect(questionId, attempt.id);
              }}
              type="radio"
            />
            <span>
              Attempt {attempt.attemptNumber}:{" "}
              {attemptStatusLabel(attempt.status)}
              {attempt.answerDurationMs !== undefined
                ? `, ${formatDuration(attempt.answerDurationMs)}`
                : ""}
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}

function ConfirmationDialog({
  action,
  onCancel,
  onConfirm,
}: {
  readonly action: Exclude<ConfirmAction, null>;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <div className="dialog-backdrop">
      <section
        aria-labelledby="discard-title"
        aria-modal="true"
        className="confirm-dialog"
        role="dialog"
      >
        <h2 id="discard-title">{confirmationTitle(action)}</h2>
        <p>{confirmationMessage(action)}</p>
        <div className="action-row">
          <Button onClick={onConfirm} type="button" variant="danger">
            Discard in-progress work
          </Button>
          <Button onClick={onCancel} type="button" variant="secondary">
            Keep practicing
          </Button>
        </div>
      </section>
    </div>
  );
}

function completedQuestionCount(machine: InterviewMachineState) {
  return Object.values(machine.attemptsByQuestion).filter((attempts) =>
    attempts.some((attempt) =>
      ["saved", "skipped", "interrupted"].includes(attempt.status),
    ),
  ).length;
}

function stateLabel(state: InterviewMachineState["state"]) {
  switch (state) {
    case "ready":
      return "Ready";
    case "preparing":
      return "Preparation";
    case "answering":
      return "Answering";
    case "reviewing":
      return "Review this answer";
    case "betweenQuestions":
      return "Between questions";
    case "complete":
      return "Practice complete";
  }
}

function timingModeLabel(
  timingMode: InterviewMachineState["settings"]["timingMode"],
) {
  switch (timingMode) {
    case "flexible":
      return "Flexible target";
    case "strictPractice":
      return "Strict practice";
    case "untimed":
      return "Untimed";
  }
}

function attemptStatusLabel(status: string) {
  switch (status) {
    case "awaiting-review":
      return "awaiting review";
    case "saved":
      return "saved";
    case "skipped":
      return "skipped";
    case "interrupted":
      return "interrupted";
    default:
      return status;
  }
}

function filterDeviceOptions(
  devices: readonly DeviceOption[],
  kind: DeviceOption["kind"],
  fallback: readonly DeviceOption[],
) {
  const filtered = devices.filter((device) => device.kind === kind);
  return filtered.length > 0 ? filtered : fallback;
}

function createRecordingStream({
  cameraStream,
  microphoneStream,
}: {
  readonly cameraStream?: MediaStream | undefined;
  readonly microphoneStream?: MediaStream | undefined;
}): MediaStream | undefined {
  const videoTracks = liveTracks(cameraStream?.getVideoTracks() ?? []);
  const audioTracks = liveTracks(microphoneStream?.getAudioTracks() ?? []);
  const tracks = [...videoTracks, ...audioTracks];
  if (tracks.length === 0) {
    return undefined;
  }

  if (videoTracks.length > 0 && audioTracks.length === 0) {
    return cameraStream;
  }

  if (audioTracks.length > 0 && videoTracks.length === 0) {
    return microphoneStream;
  }

  return new MediaStream(tracks);
}

function recordingActiveMessage({
  cameraStream,
  microphoneStream,
  settings,
}: {
  readonly cameraStream?: MediaStream | undefined;
  readonly microphoneStream?: MediaStream | undefined;
  readonly settings: InterviewMachineState["settings"];
}) {
  const hasCamera = liveTracks(cameraStream?.getVideoTracks() ?? []).length > 0;
  const hasMicrophone =
    liveTracks(microphoneStream?.getAudioTracks() ?? []).length > 0;

  if (hasCamera && hasMicrophone) {
    return "Recording camera and microphone in memory.";
  }

  if (settings.cameraRequested && settings.microphoneRequested && hasCamera) {
    return "Microphone audio was not available for combined recording. Recording video only in memory. Retry microphone, continue video-only, or return to device review.";
  }

  if (hasCamera) {
    return "Recording camera in memory.";
  }

  if (hasMicrophone) {
    return "Recording microphone in memory.";
  }

  return "Recording in memory.";
}

function liveTracks<Track extends MediaStreamTrack>(
  tracks: readonly Track[],
): readonly Track[] {
  return tracks.filter((track) => track.readyState === "live");
}

function videoAnalysisUiFromUpdate(
  update: VideoAnalysisUpdate,
): CaptureUiState {
  return {
    status: update.status === "partial" ? "active" : update.status,
    message:
      update.processedFrameCount > 0
        ? `${update.message} Samples: ${update.processedFrameCount}; dropped: ${update.droppedFrameCount}.`
        : update.message,
  };
}

function finalizeTranscriptForReview({
  attemptId,
  locale,
  manualText,
  occurredAt,
  result,
  transcriptionPreference,
}: {
  readonly attemptId: QuestionResponseId;
  readonly locale: string;
  readonly manualText: string;
  readonly occurredAt: ReturnType<typeof isoDateTime>;
  readonly result: TranscriptResult;
  readonly transcriptionPreference: TranscriptionPreference;
}): TranscriptResult {
  const manual = formatTranscriptParagraphs(manualText);
  if (manual) {
    return createManualTranscriptResult({
      revisionKey: `${attemptId}:typed-answer`,
      createdAt: occurredAt,
      text: manual,
      locale,
    });
  }
  if (transcriptionPreference === "timing-only") {
    return createTimingOnlyTranscriptResult();
  }
  if (transcriptionPreference === "manual") {
    return createUnavailableTranscriptResult({
      providerId: "manual-transcript",
      processingMode: "device",
      safeMessage: "No manual transcript was entered.",
    });
  }
  if (result.activeRevision) {
    return result;
  }
  return createUnavailableTranscriptResult({
    providerId: result.providerId || "browser-web-speech",
    processingMode: result.processingMode,
    safeMessage: "No usable speech transcript was produced.",
  });
}

function transcriptStatusMessage(result: TranscriptResult): string {
  switch (result.status) {
    case "complete":
      return result.activeRevision?.reviewedByUser
        ? "Transcript reviewed."
        : "Browser transcript ready for review.";
    case "partial":
      return "Speech recognition active; transcript is still partial.";
    case "manual":
      return "Manual transcript ready.";
    case "timing-only":
      return "Timing-only mode; no content transcript.";
    case "unavailable":
      return result.errors[0]?.safeMessage ?? "Transcript unavailable.";
  }
}

function transcriptSourceLabel(result: TranscriptResult): string {
  switch (result.activeRevision?.source) {
    case "browser-speech":
      return "browser-generated, not yet reviewed";
    case "edited-browser-speech":
      return "reviewed browser transcript";
    case "manual":
      return "manual transcript";
    case "none":
    case undefined:
      return result.status === "timing-only" ? "timing only" : "not available";
  }
}

function metricText<Value extends number>(
  metric: MetricValue<Value>,
  format: (value: Value) => string,
) {
  if (metric.status === "unavailable") {
    return "Not available";
  }

  return metric.status === "partial"
    ? `${format(metric.value)} (partial)`
    : format(metric.value);
}

function formatPercentage(value: number) {
  return `${value.toFixed(0)}%`;
}

function distributionText(metric: MetricValue<{ readonly dominant: string }>) {
  if (metric.status === "unavailable") {
    return "Not available";
  }

  const label = conditionLabel(metric.value.dominant);
  return metric.status === "partial" ? `${label} (partial)` : label;
}

function conditionLabel(value: string) {
  switch (value) {
    case "workable":
      return "Workable";
    case "too-close":
      return "Too close";
    case "too-far":
      return "Too far";
    case "edge-or-partial":
      return "Edge or partial framing";
    case "no-face-detected":
      return "No face-like shape detected";
    case "dim":
      return "Dim";
    case "balanced":
      return "Balanced";
    case "bright":
      return "Bright";
    case "possible-backlighting":
      return "Possible backlighting";
    case "uneven":
      return "Uneven";
    case "unknown":
    default:
      return "Unknown";
  }
}

function availabilityAction(
  reason: AvailabilityReason,
  medium: "audio" | "video",
): string {
  const label = medium === "audio" ? "microphone" : "camera";
  switch (reason) {
    case "not-requested":
    case "user-declined":
      return `The ${label} was not used. Continue with transcript coaching, or enable it during device review next time.`;
    case "permission-denied":
    case "permission-blocked":
      return `${label[0]?.toUpperCase()}${label.slice(1)} permission was not available. Check browser permissions before the next practice.`;
    case "unsupported":
      return `This browser could not provide ${medium} measurements. Try a current Chromium-based browser or continue without them.`;
    case "device-lost":
      return `The ${label} became unavailable. Reconnect it and run device review before trying again.`;
    case "insufficient-samples":
      return `Too little usable ${medium} data was captured. Try a longer answer after checking the ${label}.`;
    case "initialization-failed":
    case "invalid-signal":
      return `${medium === "audio" ? "Audio" : "Video"} analysis could not initialize reliably. Recheck the device and retry.`;
    case "interrupted":
      return `Capture was interrupted before enough ${medium} data was collected.`;
    case "missing-transcript":
      return "A reviewed transcript is needed for speaking-pace estimates.";
    case "storage-failed":
      return "The captured measurement could not be retained in browser storage.";
    case "unknown":
    default:
      return `${medium === "audio" ? "Audio" : "Video"} measurements were unavailable. Review device setup and try again.`;
  }
}

function audioWarningLabel(warning: AudioMetrics["warnings"][number]) {
  switch (warning) {
    case "high-noise-floor":
      return "High room or device noise floor.";
    case "possible-clipping":
      return "Some samples were close to the recording limit; review for distortion.";
    case "automatic-gain-likely":
      return "Browser or device automatic gain may have affected the levels.";
    case "all-zero-signal":
      return "The captured signal could not be validated.";
    case "device-lost":
      return "The microphone became unavailable during the answer.";
    case "tab-or-device-suspended":
      return "Capture stopped because the page or device was interrupted.";
    case "transcript-missing":
      return "Approximate words per minute needs a reviewed transcript.";
    case "insufficient-speech":
      return "Not enough detected speech time for an approximate words-per-minute value.";
    case "partial-samples":
      return "Fewer than five seconds of valid audio windows were captured.";
  }
}

function videoWarningLabel(warning: VideoMetrics["warnings"][number]) {
  switch (warning) {
    case "model-preview":
      return "MediaPipe Face Landmarker for web is treated as preview technology.";
    case "worker-unavailable":
      return "The video worker was unavailable; video metrics may be missing.";
    case "model-load-failed":
      return "The local video model could not load.";
    case "low-sample-count":
      return "Fewer than 20 video samples were processed.";
    case "many-dropped-frames":
      return "Frames were skipped to keep controls responsive.";
    case "orientation-unstable":
      return "Near-camera orientation could not be stabilized.";
    case "orientation-unavailable":
      return "Near-camera orientation was not available.";
    case "camera-auto-exposure":
      return "Camera automatic exposure may have affected lighting values.";
    case "possible-false-face-detection":
      return "Background objects may be detected as face-like shapes.";
    case "device-lost":
      return "The camera became unavailable during the answer.";
    case "partial-samples":
      return "Video samples are partial because capture was interrupted.";
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function availabilityReasonForMediaError(
  error: MediaAccessError,
): AvailabilityReason {
  switch (error.code) {
    case "permission-denied":
    case "permission-dismissed-or-pending":
      return "permission-denied";
    case "policy-blocked":
    case "insecure-context":
      return "permission-blocked";
    case "device-not-found":
    case "device-unreadable":
    case "constraints-unsatisfied":
    case "request-aborted":
      return "device-lost";
    case "unknown":
      return "unknown";
  }
}

function audioUnavailableMessage(error: MediaAccessError) {
  switch (availabilityReasonForMediaError(error)) {
    case "permission-denied":
      return "Microphone permission was not granted. Audio timing will be marked not available.";
    case "permission-blocked":
      return "This browser or page policy blocked microphone access. Audio timing will be marked not available.";
    case "device-lost":
      return "The microphone was unavailable. You can continue without audio timing.";
    case "unknown":
    default:
      return "Audio timing could not start. You can continue without it.";
  }
}

function cameraUnavailableMessage(error: MediaAccessError) {
  switch (availabilityReasonForMediaError(error)) {
    case "permission-denied":
      return "Camera permission was not granted. Video conditions will be marked not available.";
    case "permission-blocked":
      return "This browser or page policy blocked camera access. Video conditions will be marked not available.";
    case "device-lost":
      return "The camera was unavailable. You can continue without video conditions.";
    case "unknown":
    default:
      return "Camera preview could not start. You can continue without it.";
  }
}

function recorderFailureMessage(code: RecorderFailureCode) {
  switch (code) {
    case "unsupported":
      return "Recording is not supported in this browser.";
    case "mime-rejected":
      return "The browser rejected the available recording formats.";
    case "recorder-error":
      return "Recording stopped because the browser recorder reported an error.";
    case "zero-byte":
      return "Recording produced no usable data and was not saved.";
  }
}

function storageFailureMessage(code: string) {
  switch (code) {
    case "quota-exceeded":
      return "Recording could not be saved because browser storage is full or unavailable. You can discard it, retry after deleting saved items, or save the answer without recording.";
    case "blocked":
      return "Recording storage is blocked by another tab. Close other FairScreen tabs and retry, or save the answer without recording.";
    case "unavailable":
    case "not-open":
      return "Recording storage is unavailable in this browser context. You can save the answer without recording.";
    default:
      return "Recording could not be saved. You can retry, discard it, or save the answer without recording.";
  }
}

function confirmationTitle(action: Exclude<ConfirmAction, null>) {
  switch (action) {
    case "end":
      return "End practice?";
    case "exit":
      return "Exit practice?";
    case "skip":
      return "Skip this question?";
  }
}

function confirmationMessage(action: Exclude<ConfirmAction, null>) {
  switch (action) {
    case "end":
      return "Ending now discards the in-progress answer draft and completes the practice session.";
    case "exit":
      return "Exiting returns to setup from a safe non-capturing state. Active timers and media will not restart.";
    case "skip":
      return "Skipping discards the current preparation work for this question.";
  }
}

function monotonicNowMs() {
  return Math.round(performance.now());
}

function nowIso() {
  return isoDateTime(new Date().toISOString());
}
