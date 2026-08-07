import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BrowserServicesProvider,
  type BrowserServices,
} from "../../app/BrowserServicesProvider";
import { FairScreenRepositoryProvider } from "../../app/FairScreenRepositoryProvider";
import { ResourceRegistryProvider } from "../../app/ResourceRegistryProvider";
import {
  byteCount,
  decibelsFullScale,
  degrees,
  hertz,
  interviewQuestionId,
  isoDateTime,
  milliseconds,
  recordingId,
} from "../../domain/factories";
import type {
  AudioMetrics,
  InterviewQuestion,
  VideoMetrics,
} from "../../domain/models";
import { createUnknownCapabilityReport } from "../../infrastructure/browser/capabilities";
import { createUnavailableTranscriptionProvider } from "../../infrastructure/browser/speechRecognition";
import { EphemeralFairScreenRepository } from "../../infrastructure/storage/ephemeral/EphemeralFairScreenRepository";
import { createDeterministicAnswerAnalyzer } from "../analysis/DeterministicAnswerAnalyzer";
import type { VideoAnalysisUpdate } from "../../infrastructure/browser/videoAnalysisClient";
import { DeviceCheckPage } from "../device-check/DeviceCheckPage";
import { QuestionProviderProvider } from "../questions/QuestionProviderContext";
import { SetupPage } from "../setup/SetupPage";
import { SavedSessionsPage } from "../sessions/SavedSessionsPage";
import { createDefaultSetupDraft, type SetupDraft } from "../setup/setupDraft";
import { SetupDraftProvider } from "../setup/SetupDraftProvider";
import { AUDIO_METRIC_ALGORITHM_VERSION } from "../audio/audioMetrics";
import { createVideoMetricsAggregator } from "../video/aggregate";
import {
  createSessionIdFromDraft,
  createInterviewStateFromDraft,
  serializeInterviewProgress,
  type InterviewProgressRecord,
} from "./progressPersistence";
import { createSessionStorageInterviewProgressStore } from "./progressStore";
import { interviewReducer, type InterviewEvent } from "./machine";
import { InterviewPage } from "./InterviewPage";

const timestamp = isoDateTime("2026-01-01T00:00:00.000Z");
type EventInput = InterviewEvent extends infer Event
  ? Event extends InterviewEvent
    ? Omit<Event, "occurredAt" | "nowMs">
    : never
  : never;

afterEach(() => {
  window.sessionStorage.clear();
});

describe("InterviewPage", () => {
  it("supports a keyboard-only complete interview journey", async () => {
    const user = userEvent.setup();
    renderInterview();

    await keyboardActivate(user, "Start preparation");
    expect(
      within(screen.getByLabelText("Interview status")).getByText(
        "Preparation",
      ),
    ).toBeInTheDocument();

    await keyboardActivate(user, "Start answer now");
    await user.type(screen.getByLabelText(/Answer text/), "A concise answer.");
    await keyboardActivate(user, "Finish answer");

    expect(
      within(screen.getByLabelText("Interview status")).getByText(
        "Review this answer",
      ),
    ).toBeInTheDocument();
    await keyboardActivate(user, "Save and continue");
    expect(
      screen.getByText("The next question is ready when you are."),
    ).toBeInTheDocument();

    await keyboardActivate(user, "Next question");
    expect(
      screen.getByRole("heading", { level: 1, name: "Question 2 of 2" }),
    ).toBeInTheDocument();

    await keyboardActivate(user, "Skip question");
    await keyboardActivate(user, "Next question");

    expect(
      within(screen.getByLabelText("Interview status")).getByText(
        "Practice complete",
      ),
    ).toBeInTheDocument();
    const reportLink = screen.getByRole("link", { name: "View report" });
    expect(reportLink).toHaveAttribute(
      "href",
      expect.stringContaining("/interviews/"),
    );
    expect(reportLink).toHaveAttribute(
      "href",
      expect.not.stringContaining("/draft/"),
    );
  });

  it("uses typed text without asking for speech recognition when no microphone is selected", async () => {
    const user = userEvent.setup();
    const getCapability = vi.fn().mockResolvedValue({
      status: "supported",
      processingMode: "vendor-service",
      disclosureRequired: true,
      limitations: [],
    });
    const start = vi.fn();
    renderInterview(
      {
        ...draftWithQuestions(),
        transcription: "ask-when-supported",
        microphoneRequested: false,
      },
      createFakeBrowserServices({
        transcription: {
          kind: "browser-speech",
          getCapability,
          start,
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: "Start preparation" }));
    await user.click(screen.getByRole("button", { name: "Start answer now" }));
    expect(
      screen.queryByRole("dialog", { name: "Use browser speech recognition?" }),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Answer text"),
      "I would define the failure behaviour first. I would use a timeout and a fallback. Then I would test the failure path and monitor user impact.",
    );
    await user.click(screen.getByRole("button", { name: "Finish answer" }));

    const transcript = await screen.findByLabelText("Editable transcript");
    expect((transcript as HTMLTextAreaElement).value).toContain(
      "I would use a timeout and a fallback.",
    );
    expect((transcript as HTMLTextAreaElement).value).toContain("\n\n");
    expect(getCapability).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it("finishes immediately with typed text even when browser recognition is active", async () => {
    const user = userEvent.setup();
    const abort = vi.fn();
    const stop = vi.fn(() => new Promise<never>(() => undefined));
    const services = createFakeBrowserServices({
      transcription: {
        kind: "browser-speech",
        getCapability: vi.fn().mockResolvedValue({
          status: "supported",
          processingMode: "vendor-service",
          disclosureRequired: true,
          limitations: ["Test disclosure."],
        }),
        start: vi.fn().mockResolvedValue({
          sessionId: "speech:test",
          stop,
          abort,
          subscribe: vi.fn(() => () => undefined),
        }),
      },
    });
    renderInterview(
      {
        ...draftWithQuestions(),
        transcription: "ask-when-supported",
        microphoneRequested: true,
      },
      services,
    );

    await user.click(screen.getByRole("button", { name: "Start preparation" }));
    await user.click(screen.getByRole("button", { name: "Start answer now" }));
    await user.click(
      within(
        await screen.findByRole("dialog", {
          name: "Use browser speech recognition?",
        }),
      ).getByRole("button", { name: "Accept and start answer" }),
    );
    await user.type(
      await screen.findByLabelText("Answer text"),
      "I typed the answer, so finishing must not wait for the recognition service.",
    );
    await user.click(screen.getByRole("button", { name: "Finish answer" }));

    expect(await screen.findByLabelText("Editable transcript")).toHaveValue(
      "I typed the answer, so finishing must not wait for the recognition service.",
    );
    expect(abort).toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it("shows a newly saved answer in Saved Sessions even when navigation happens immediately", async () => {
    const user = userEvent.setup();
    const repository = new EphemeralFairScreenRepository();
    await repository.open();

    render(
      <MemoryRouter initialEntries={["/interviews/draft/practice"]}>
        <ResourceRegistryProvider>
          <BrowserServicesProvider services={createFakeBrowserServices()}>
            <FairScreenRepositoryProvider repository={repository}>
              <SetupDraftProvider initialDraft={draftWithQuestions()}>
                <Link to="/saved">Open saved sessions</Link>
                <Routes>
                  <Route
                    path="/interviews/:sessionId/practice"
                    element={<InterviewPage />}
                  />
                  <Route path="/saved" element={<SavedSessionsPage />} />
                </Routes>
              </SetupDraftProvider>
            </FairScreenRepositoryProvider>
          </BrowserServicesProvider>
        </ResourceRegistryProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Start preparation" }));
    await user.click(screen.getByRole("button", { name: "Start answer now" }));
    await user.type(
      screen.getByLabelText("Answer text"),
      "I documented the decision, tested the fallback, and measured the result.",
    );
    await user.click(screen.getByRole("button", { name: "Finish answer" }));
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    await user.click(screen.getByRole("link", { name: "Open saved sessions" }));

    expect(
      await screen.findByRole("heading", { name: "Product analyst" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("1 of 2 questions")).toBeInTheDocument();
  });

  it("prevents double activation from creating duplicate attempts", async () => {
    const user = userEvent.setup();
    renderInterview();

    await user.dblClick(
      screen.getByRole("button", { name: "Start preparation" }),
    );
    await user.dblClick(
      screen.getByRole("button", { name: "Start answer now" }),
    );
    await user.click(screen.getByRole("button", { name: "Finish answer" }));

    const attemptPanel = screen.getByRole("complementary", {
      name: "Preview and attempts",
    });
    expect(
      within(attemptPanel).getAllByRole("radio", {
        name: /Attempt 1: awaiting review/,
      }),
    ).toHaveLength(1);
    expect(screen.queryByText(/Attempt 2/)).not.toBeInTheDocument();
  });

  it("confirms skip, end, and exit before discarding in-progress work", async () => {
    const user = userEvent.setup();
    renderInterview();

    await user.click(screen.getByRole("button", { name: "Start preparation" }));
    await user.click(screen.getByRole("button", { name: "Skip question" }));
    expect(
      screen.getByRole("dialog", { name: "Skip this question?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep practicing" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "End practice" }));
    expect(
      screen.getByRole("dialog", { name: "End practice?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep practicing" }));

    await user.click(screen.getByRole("button", { name: "Exit" }));
    expect(
      screen.getByRole("dialog", { name: "Exit practice?" }),
    ).toBeInTheDocument();
  });

  it("supports preview visibility and global media stop controls", async () => {
    const user = userEvent.setup();
    renderInterview();

    await user.click(screen.getByRole("button", { name: "Hide my preview" }));
    expect(screen.getByText("Preview hidden")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show my preview" }));
    expect(screen.getByText("No camera selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stop media" }));
    expect(await screen.findByText("Media stopped.")).toBeInTheDocument();
  });

  it("keeps retry attempts separate and requires user-selected report attempt", async () => {
    const user = userEvent.setup();
    renderInterview();

    await user.click(screen.getByRole("button", { name: "Start preparation" }));
    await user.click(screen.getByRole("button", { name: "Start answer now" }));
    await user.type(screen.getByLabelText(/Answer text/), "First attempt");
    await user.click(screen.getByRole("button", { name: "Finish answer" }));
    await user.click(
      screen.getByRole("button", { name: "Repeat this question" }),
    );
    await user.click(screen.getByRole("button", { name: "Start answer now" }));
    await user.type(screen.getByLabelText(/Answer text/), "Second attempt");
    await user.click(screen.getByRole("button", { name: "Finish answer" }));

    expect(screen.getByText(/Attempt 1: saved/)).toBeInTheDocument();
    expect(screen.getByText(/Attempt 2: awaiting review/)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(
      screen
        .getAllByRole("radio")
        .some((radio) => (radio as HTMLInputElement).checked),
    ).toBe(false);

    await user.click(screen.getByRole("radio", { name: /Attempt 1: saved/ }));
    expect(
      screen.getByRole("radio", { name: /Attempt 1: saved/ }),
    ).toBeChecked();
  });

  it("silences timer threshold announcements while preserving visible timer state", async () => {
    const user = userEvent.setup();
    renderInterview({
      ...draftWithQuestions(),
      preparationTimeSeconds: 0,
      answerTimeSeconds: 30,
      timingMode: "strictPractice",
    });

    await user.click(
      screen.getByRole("checkbox", { name: "Announce timer thresholds" }),
    );
    await user.click(screen.getByRole("button", { name: "Start preparation" }));
    expect(
      screen.getByRole("checkbox", { name: "Announce timer thresholds" }),
    ).not.toBeChecked();
    expect(screen.getByLabelText("Timer")).toHaveTextContent("Strict practice");
  });

  it("recovers reload checkpoints to Ready without active timers or devices", () => {
    const draft = draftWithQuestions();
    let active = createInterviewStateFromDraft(draft);
    active = reduce(active, { type: "START_PREP" }, 0);
    active = reduce(active, { type: "START_ANSWER" }, 1_000);
    createSessionStorageInterviewProgressStore(window.sessionStorage).write(
      serializeInterviewProgress(active, timestamp),
    );

    renderInterview(draft);

    expect(
      within(screen.getByLabelText("Interview status")).getByText("Ready"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Finish answer" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No microphone active.")).toBeInTheDocument();
    expect(screen.getByText("Recording off.")).toBeInTheDocument();
    expect(screen.getByLabelText("Timer")).toHaveTextContent("No countdown");
  });

  it("starts another identical job title as a fresh session with current media settings", async () => {
    const user = userEvent.setup();
    const repeatedDraft: SetupDraft = {
      ...draftWithQuestions(),
      questionCount: 1,
      generatedQuestions: [question("one", 0)],
      cameraRequested: true,
      microphoneRequested: true,
      recordingCaptureRequested: true,
    };
    let completed = createInterviewStateFromDraft(repeatedDraft);
    completed = reduce(completed, { type: "START_PREP" }, 0);
    completed = reduce(completed, { type: "START_ANSWER" }, 1_000);
    completed = reduce(
      completed,
      { type: "FINISH_ANSWER", notes: "Old answer" },
      5_000,
    );
    completed = reduce(
      completed,
      { type: "SAVE_REVIEW", notes: "Old answer" },
      6_000,
    );
    completed = reduce(completed, { type: "NEXT_QUESTION" }, 7_000);
    const oldSessionId = createSessionIdFromDraft(repeatedDraft);
    const progressStore = createSessionStorageInterviewProgressStore(
      window.sessionStorage,
    );
    progressStore.write(serializeInterviewProgress(completed, timestamp));

    renderPracticeFlow(repeatedDraft);

    expect(
      within(screen.getByLabelText("Interview status")).getByText(
        "Practice complete",
      ),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Start another interview" }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Practice setup" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Start without camera or microphone",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Begin practice" }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Question 1 of 1",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Interview status")).getByText("Ready"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Attempt 1/ })).toBeNull();
    expect(screen.getByText("No camera active.")).toBeInTheDocument();
    expect(screen.getByText("No microphone active.")).toBeInTheDocument();
    expect(screen.getByText("Recording off.")).toBeInTheDocument();

    expect(progressStore.read(oldSessionId)).toBeNull();
    const records = readProgressRecords();
    expect(records).toHaveLength(1);
    const [record] = records;
    expect(record?.sessionId).not.toBe(oldSessionId);
    expect(record?.state).toBe("ready");
    expect(record?.currentQuestionIndex).toBe(0);
    expect(record?.attemptsByQuestion).toEqual({});
    expect(record?.settings.cameraRequested).toBe(false);
    expect(record?.settings.microphoneRequested).toBe(false);
    expect(record?.settings.recordingCaptureRequested).toBe(false);
  });

  it("starts microphone audio measurement only after answer start and shows approved aggregates", async () => {
    const user = userEvent.setup();
    const audioMetrics = syntheticAudioMetrics();
    const stopAudio = vi.fn().mockResolvedValue(audioMetrics);
    const services = createFakeBrowserServices({
      startAudioMetricSession: vi.fn().mockResolvedValue({
        ok: true,
        session: {
          stop: stopAudio,
          dispose: vi.fn().mockResolvedValue(undefined),
        },
      }),
    });
    renderInterview(
      {
        ...draftWithQuestions(),
        microphoneRequested: true,
      },
      services,
    );

    expect(services.mediaDevices.requestMicrophone).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Start preparation" }));
    expect(services.mediaDevices.requestMicrophone).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Start answer now" }));
    expect(await screen.findByText("Microphone active.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish answer" }));

    expect(await screen.findByText("-28.0 dBFS")).toBeInTheDocument();
    expect(screen.getByText("0:04")).toBeInTheDocument();
    expect(stopAudio).toHaveBeenCalledTimes(1);
    expect(services.mediaDevices.stopStream).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(audioMetrics)).not.toMatch(/pcm|Float32Array/i);
  });

  it("starts camera preview and local video analysis only after answer start", async () => {
    const user = userEvent.setup();
    const cameraStream = createFakeStream({ video: true, audio: false });
    const videoMetrics = syntheticVideoMetrics();
    const stopVideo = vi.fn().mockResolvedValue(videoMetrics);
    const services = createFakeBrowserServices({
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([
          {
            deviceId: "camera-1",
            kind: "camera" as const,
            label: "Front camera",
            isDefault: false,
          },
        ]),
        requestCamera: vi.fn().mockResolvedValue({
          ok: true,
          stream: cameraStream,
          devices: [],
        }),
        requestMicrophone: vi.fn(),
        stopStream: vi.fn(),
      },
      startVideoAnalysisSession: vi.fn().mockResolvedValue({
        ok: true,
        session: {
          stop: stopVideo,
          dispose: vi.fn().mockResolvedValue(undefined),
          subscribe: (listener: (update: VideoAnalysisUpdate) => void) => {
            listener({
              status: "active",
              processedFrameCount: 1,
              droppedFrameCount: 0,
              invalidFrameCount: 0,
              message: "Video analysis active.",
            });
            return () => undefined;
          },
        },
      }),
    });
    renderInterview(
      {
        ...draftWithQuestions(),
        cameraRequested: true,
      },
      services,
    );

    expect(services.mediaDevices.requestCamera).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Start preparation" }));
    expect(services.mediaDevices.requestCamera).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Start answer now" }));
    expect(await screen.findByText("Camera active.")).toBeInTheDocument();
    expect(
      await screen.findByText(/Video analysis active\. Samples: 1/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish answer" }));

    expect(
      await screen.findByRole("heading", { name: "Video conditions" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
    expect(stopVideo).toHaveBeenCalledTimes(1);
    expect(services.mediaDevices.stopStream).toHaveBeenCalledWith(cameraStream);
    expect(JSON.stringify(videoMetrics)).not.toMatch(
      /frameData|faceLandmarks|landmarks|blendshapes|pixels|facialTransformationMatrixes|embedding/i,
    );
  });

  it("keeps a captured recording transient until explicit post-review save", async () => {
    const user = userEvent.setup();
    installObjectUrlFakes();
    const audioMetrics = syntheticAudioMetrics();
    const saveRecording = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: recordingId("recording:saved"),
        mimeType: "audio/webm",
        sizeBytes: byteCount(4),
        durationMs: milliseconds(6_000),
        savedByUserAt: timestamp,
      },
    });
    const services = createFakeBrowserServices({
      startAudioMetricSession: vi.fn().mockResolvedValue({
        ok: true,
        session: {
          stop: vi.fn().mockResolvedValue(audioMetrics),
          dispose: vi.fn().mockResolvedValue(undefined),
        },
      }),
      startRecorderSession: vi.fn(() => ({
        ok: true as const,
        session: {
          mimeType: "audio/webm",
          stop: vi.fn().mockResolvedValue({
            ok: true,
            recording: {
              blob: new Blob(["test"], { type: "audio/webm" }),
              mimeType: "audio/webm",
              sizeBytes: byteCount(4),
              durationMs: milliseconds(6_000),
            },
          }),
          discard: vi.fn().mockResolvedValue(undefined),
        },
      })),
      saveRecordingAfterUserChoice: saveRecording,
    });
    renderInterview(
      {
        ...draftWithQuestions(),
        microphoneRequested: true,
        recordingCaptureRequested: true,
      },
      services,
    );

    await user.click(screen.getByRole("button", { name: "Start preparation" }));
    await user.click(screen.getByRole("button", { name: "Start answer now" }));
    expect(
      await screen.findByText("Recording microphone in memory."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish answer" }));

    expect(
      await screen.findByRole("heading", { name: "Recording" }),
    ).toBeInTheDocument();
    expect(saveRecording).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    const dialog = screen.getByRole("dialog", {
      name: "Save or discard recording?",
    });
    await user.click(
      within(dialog).getByRole("button", {
        name: "Save recording on this device",
      }),
    );

    expect(saveRecording).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("The next question is ready when you are."),
    ).toBeInTheDocument();
  });

  it("persists the reviewed transcript and recording reference in the same saved answer", async () => {
    const user = userEvent.setup();
    installObjectUrlFakes();
    const repository = new EphemeralFairScreenRepository();
    await repository.open();
    const draft = {
      ...draftWithQuestions(),
      microphoneRequested: true,
      recordingCaptureRequested: true,
    };
    const savedReference = {
      id: recordingId("recording:persisted-answer"),
      mimeType: "audio/webm",
      sizeBytes: byteCount(4),
      durationMs: milliseconds(6_000),
      savedByUserAt: timestamp,
    };
    const services = createFakeBrowserServices({
      startAudioMetricSession: vi.fn().mockResolvedValue({
        ok: true,
        session: {
          stop: vi.fn().mockResolvedValue(syntheticAudioMetrics()),
          dispose: vi.fn().mockResolvedValue(undefined),
        },
      }),
      startRecorderSession: vi.fn(() => ({
        ok: true as const,
        session: {
          mimeType: "audio/webm",
          stop: vi.fn().mockResolvedValue({
            ok: true,
            recording: {
              blob: new Blob(["test"], { type: "audio/webm" }),
              mimeType: "audio/webm",
              sizeBytes: byteCount(4),
              durationMs: milliseconds(6_000),
            },
          }),
          discard: vi.fn().mockResolvedValue(undefined),
        },
      })),
      saveRecordingAfterUserChoice: vi.fn().mockResolvedValue({
        ok: true,
        value: savedReference,
      }),
    });

    render(
      <MemoryRouter initialEntries={["/interviews/draft/practice"]}>
        <ResourceRegistryProvider>
          <BrowserServicesProvider services={services}>
            <FairScreenRepositoryProvider repository={repository}>
              <SetupDraftProvider initialDraft={draft}>
                <Routes>
                  <Route
                    path="/interviews/:sessionId/practice"
                    element={<InterviewPage />}
                  />
                </Routes>
              </SetupDraftProvider>
            </FairScreenRepositoryProvider>
          </BrowserServicesProvider>
        </ResourceRegistryProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Start preparation" }));
    await user.click(screen.getByRole("button", { name: "Start answer now" }));
    await user.type(
      screen.getByLabelText("Answer text"),
      "I reviewed the issue, documented my actions, and confirmed the result.",
    );
    await user.click(screen.getByRole("button", { name: "Finish answer" }));
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    await user.click(
      within(
        screen.getByRole("dialog", { name: "Save or discard recording?" }),
      ).getByRole("button", { name: "Save recording on this device" }),
    );

    expect(
      await screen.findByText("The next question is ready when you are."),
    ).toBeInTheDocument();
    const responses = await repository.listResponses(
      createSessionIdFromDraft(draft),
    );
    expect(responses.ok).toBe(true);
    if (!responses.ok) return;
    expect(responses.value).toHaveLength(1);
    expect(responses.value[0]?.recording).toEqual(savedReference);
    expect(responses.value[0]?.transcript.activeRevision?.text).toContain(
      "I reviewed the issue",
    );
  });

  it("supports video-only recording when camera is selected without microphone", async () => {
    const user = userEvent.setup();
    installObjectUrlFakes();
    const cameraStream = createFakeStream({ video: true, audio: false });
    const saveRecording = vi.fn();
    const services = createFakeBrowserServices({
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        requestCamera: vi.fn().mockResolvedValue({
          ok: true,
          stream: cameraStream,
          devices: [],
        }),
        requestMicrophone: vi.fn(),
        stopStream: vi.fn(),
      },
      startRecorderSession: vi.fn(() => ({
        ok: true as const,
        session: {
          mimeType: "video/webm",
          stop: vi.fn().mockResolvedValue({
            ok: true,
            recording: {
              blob: new Blob(["video"], { type: "video/webm" }),
              mimeType: "video/webm",
              sizeBytes: byteCount(5),
              durationMs: milliseconds(6_000),
            },
          }),
          discard: vi.fn().mockResolvedValue(undefined),
        },
      })),
      saveRecordingAfterUserChoice: saveRecording,
    });
    renderInterview(
      {
        ...draftWithQuestions(),
        cameraRequested: true,
        microphoneRequested: false,
        recordingCaptureRequested: true,
      },
      services,
    );

    await user.click(screen.getByRole("button", { name: "Start preparation" }));
    await user.click(screen.getByRole("button", { name: "Start answer now" }));
    expect(
      await screen.findByText("Recording camera in memory."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish answer" }));

    expect(
      await screen.findByLabelText("Captured answer video recording"),
    ).toBeInTheDocument();
    expect(saveRecording).not.toHaveBeenCalled();
  });

  it("combines camera and microphone tracks for recording when both are selected", async () => {
    const user = userEvent.setup();
    const restoreMediaStream = installMediaStreamConstructor();
    const cameraStream = createFakeStream({ video: true, audio: false });
    const microphoneStream = createFakeStream({ video: false, audio: true });
    const startRecorderSession = vi.fn(
      (input: {
        readonly stream: MediaStream;
        readonly startedAtMs: number;
      }) => ({
        ...input,
        ok: false as const,
        code: "unsupported" as const,
      }),
    );
    const services = createFakeBrowserServices({
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        requestCamera: vi.fn().mockResolvedValue({
          ok: true,
          stream: cameraStream,
          devices: [],
        }),
        requestMicrophone: vi.fn().mockResolvedValue({
          ok: true,
          stream: microphoneStream,
          devices: [],
        }),
        stopStream: vi.fn(),
      },
      startRecorderSession,
    });

    try {
      renderInterview(
        {
          ...draftWithQuestions(),
          cameraRequested: true,
          microphoneRequested: true,
          recordingCaptureRequested: true,
        },
        services,
      );

      await user.click(
        screen.getByRole("button", { name: "Start preparation" }),
      );
      await user.click(
        screen.getByRole("button", { name: "Start answer now" }),
      );

      await waitFor(() => {
        expect(startRecorderSession).toHaveBeenCalled();
      });
      const firstRecorderCall = startRecorderSession.mock.calls[0];
      expect(firstRecorderCall).toBeDefined();
      const stream = firstRecorderCall?.[0].stream;
      expect(stream?.getTracks()).toHaveLength(2);
      expect(stream?.getVideoTracks()).toHaveLength(1);
      expect(stream?.getAudioTracks()).toHaveLength(1);
      expect(stream?.getVideoTracks()[0]?.readyState).toBe("live");
      expect(stream?.getAudioTracks()[0]?.readyState).toBe("live");
    } finally {
      restoreMediaStream();
    }
  });

  it("shows combined recording playback metadata when audio and video are present", async () => {
    const user = userEvent.setup();
    installObjectUrlFakes();
    const restoreMediaStream = installMediaStreamConstructor();
    const cameraStream = createFakeStream({ video: true, audio: false });
    const microphoneStream = createFakeStream({ video: false, audio: true });
    let capturedStream: MediaStream | undefined;
    const services = createFakeBrowserServices({
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        requestCamera: vi.fn().mockResolvedValue({
          ok: true,
          stream: cameraStream,
          devices: [],
        }),
        requestMicrophone: vi.fn().mockResolvedValue({
          ok: true,
          stream: microphoneStream,
          devices: [],
        }),
        stopStream: vi.fn(),
      },
      startRecorderSession: vi.fn((input: { readonly stream: MediaStream }) => {
        capturedStream = input.stream;
        return {
          ok: true as const,
          session: {
            mimeType: "video/webm;codecs=vp9,opus",
            stop: vi.fn().mockResolvedValue({
              ok: true,
              recording: {
                blob: new Blob(["combined"], {
                  type: "video/webm;codecs=vp9,opus",
                }),
                mimeType: "video/webm;codecs=vp9,opus",
                sizeBytes: byteCount(8),
                durationMs: milliseconds(6_000),
              },
            }),
            discard: vi.fn().mockResolvedValue(undefined),
          },
        };
      }),
    });

    try {
      renderInterview(
        {
          ...draftWithQuestions(),
          cameraRequested: true,
          microphoneRequested: true,
          recordingCaptureRequested: true,
        },
        services,
      );

      await user.click(
        screen.getByRole("button", { name: "Start preparation" }),
      );
      await user.click(
        screen.getByRole("button", { name: "Start answer now" }),
      );
      expect(
        await screen.findByText("Recording camera and microphone in memory."),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Finish answer" }));

      expect(
        await screen.findByLabelText("Captured answer video recording"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Format: video\/webm;codecs=vp9,opus/),
      ).toBeInTheDocument();
      expect(capturedStream?.getVideoTracks()).toHaveLength(1);
      expect(capturedStream?.getAudioTracks()).toHaveLength(1);
    } finally {
      restoreMediaStream();
    }
  });

  it("keeps transient review available after quota failure and allows saving answer without recording", async () => {
    const user = userEvent.setup();
    installObjectUrlFakes();
    const services = createFakeBrowserServices({
      startAudioMetricSession: vi.fn().mockResolvedValue({
        ok: true,
        session: {
          stop: vi.fn().mockResolvedValue(syntheticAudioMetrics()),
          dispose: vi.fn().mockResolvedValue(undefined),
        },
      }),
      startRecorderSession: vi.fn(() => ({
        ok: true as const,
        session: {
          mimeType: "audio/webm",
          stop: vi.fn().mockResolvedValue({
            ok: true,
            recording: {
              blob: new Blob(["test"], { type: "audio/webm" }),
              mimeType: "audio/webm",
              sizeBytes: byteCount(4),
              durationMs: milliseconds(6_000),
            },
          }),
          discard: vi.fn().mockResolvedValue(undefined),
        },
      })),
      saveRecordingAfterUserChoice: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: "quota-exceeded",
          operation: "save-recording",
          recoverable: true,
          actions: ["continue-without-recording"],
        },
      }),
    });
    renderInterview(
      {
        ...draftWithQuestions(),
        microphoneRequested: true,
        recordingCaptureRequested: true,
      },
      services,
    );

    await user.click(screen.getByRole("button", { name: "Start preparation" }));
    await user.click(screen.getByRole("button", { name: "Start answer now" }));
    await screen.findByText("Recording microphone in memory.");
    await user.click(screen.getByRole("button", { name: "Finish answer" }));
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    const dialog = screen.getByRole("dialog", {
      name: "Save or discard recording?",
    });
    await user.click(
      within(dialog).getByRole("button", {
        name: "Save recording on this device",
      }),
    );

    expect(
      await within(dialog).findByText(
        /browser storage is full or unavailable/i,
      ),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", {
        name: "Save answer without recording",
      }),
    );

    expect(
      await screen.findByText("The next question is ready when you are."),
    ).toBeInTheDocument();
  });
});

function renderInterview(
  initialDraft = draftWithQuestions(),
  services = createFakeBrowserServices(),
) {
  return render(
    <MemoryRouter initialEntries={["/interviews/draft/practice"]}>
      <ResourceRegistryProvider>
        <BrowserServicesProvider services={services}>
          <SetupDraftProvider initialDraft={initialDraft}>
            <InterviewPage />
          </SetupDraftProvider>
        </BrowserServicesProvider>
      </ResourceRegistryProvider>
    </MemoryRouter>,
  );
}

function renderPracticeFlow(
  initialDraft = draftWithQuestions(),
  services = createFakeBrowserServices(),
) {
  return render(
    <MemoryRouter initialEntries={["/interviews/draft/practice"]}>
      <ResourceRegistryProvider>
        <BrowserServicesProvider services={services}>
          <QuestionProviderProvider>
            <SetupDraftProvider initialDraft={initialDraft}>
              <Routes>
                <Route path="/interviews/new" element={<SetupPage />} />
                <Route
                  path="/interviews/:sessionId/devices"
                  element={<DeviceCheckPage />}
                />
                <Route
                  path="/interviews/:sessionId/practice"
                  element={<InterviewPage />}
                />
              </Routes>
            </SetupDraftProvider>
          </QuestionProviderProvider>
        </BrowserServicesProvider>
      </ResourceRegistryProvider>
    </MemoryRouter>,
  );
}

function draftWithQuestions(): SetupDraft {
  return {
    ...createDefaultSetupDraft(),
    jobTitle: "Product analyst",
    questionCount: 2,
    preparationTimeSeconds: 60,
    answerTimeSeconds: 120,
    generatedQuestions: [question("one", 0), question("two", 1)],
  };
}

function readProgressRecords(): readonly InterviewProgressRecord[] {
  const records: InterviewProgressRecord[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (!key?.startsWith("fairscreen:m06:interview-progress:")) {
      continue;
    }

    const raw = window.sessionStorage.getItem(key);
    if (raw) {
      records.push(JSON.parse(raw) as InterviewProgressRecord);
    }
  }

  return records;
}

function createFakeBrowserServices(
  overrides: Partial<BrowserServices> = {},
): BrowserServices {
  const stream = createFakeStream();
  return {
    capabilities: {
      getReport: vi.fn().mockResolvedValue(createUnknownCapabilityReport()),
    },
    mediaDevices: {
      enumerateDevices: vi.fn().mockResolvedValue([
        {
          deviceId: "microphone-1",
          kind: "microphone" as const,
          label: "Desk microphone",
          isDefault: false,
        },
      ]),
      requestCamera: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: "device-not-found",
          message: "No camera.",
        },
      }),
      requestMicrophone: vi.fn().mockResolvedValue({
        ok: true,
        stream,
        devices: [],
      }),
      stopStream: vi.fn(),
    },
    createMicrophoneLevelMonitor: vi.fn(() => ({
      subscribe: vi.fn(() => () => undefined),
      stop: vi.fn().mockResolvedValue(undefined),
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
        retrievedAt: timestamp,
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
    ...overrides,
  };
}

function createFakeStream(
  options: { readonly audio?: boolean; readonly video?: boolean } = {
    audio: true,
    video: false,
  },
) {
  const audioTracks = options.audio === false ? [] : [createFakeTrack("audio")];
  const videoTracks = options.video === true ? [createFakeTrack("video")] : [];
  const tracks = [...audioTracks, ...videoTracks];
  return {
    getTracks: () => tracks,
    getAudioTracks: () => audioTracks,
    getVideoTracks: () => videoTracks,
  } as unknown as MediaStream;
}

function createFakeTrack(kind: "audio" | "video") {
  return {
    kind,
    readyState: "live",
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;
}

function installMediaStreamConstructor() {
  const previous = globalThis.MediaStream;
  class FakeMediaStream {
    readonly #tracks: readonly MediaStreamTrack[];

    constructor(tracks: readonly MediaStreamTrack[]) {
      this.#tracks = tracks;
    }

    getTracks() {
      return this.#tracks;
    }

    getAudioTracks() {
      return this.#tracks.filter((track) => track.kind === "audio");
    }

    getVideoTracks() {
      return this.#tracks.filter((track) => track.kind === "video");
    }
  }

  Object.defineProperty(globalThis, "MediaStream", {
    configurable: true,
    value: FakeMediaStream,
  });

  return () => {
    Object.defineProperty(globalThis, "MediaStream", {
      configurable: true,
      value: previous,
    });
  };
}

function installObjectUrlFakes() {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:fairscreen-test-recording"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
}

function syntheticAudioMetrics(): AudioMetrics {
  const limitations = ["Synthetic timing fixture for component tests."];
  return {
    algorithmVersion: AUDIO_METRIC_ALGORITHM_VERSION,
    status: "complete",
    sampleRateHz: hertz(20),
    sampleCount: 120,
    invalidSampleCount: 0,
    calibration: {
      sampleCount: 20,
      noiseFloorDbfs: decibelsFullScale(-60),
      speechThresholdDbfs: decibelsFullScale(-50),
      attackMs: milliseconds(150),
      releaseMs: milliseconds(250),
      calibrationQuality: "adequate",
    },
    answerDurationMs: {
      status: "available",
      value: milliseconds(6_000),
      calculationQuality: "adequate",
      limitations,
    },
    delayBeforeSpeechMs: {
      status: "available",
      value: milliseconds(500),
      calculationQuality: "adequate",
      limitations,
    },
    speakingDurationMs: {
      status: "available",
      value: milliseconds(4_000),
      calculationQuality: "adequate",
      limitations,
    },
    silenceDurationMs: {
      status: "available",
      value: milliseconds(2_000),
      calculationQuality: "adequate",
      limitations,
    },
    longestInternalSilenceMs: {
      status: "available",
      value: milliseconds(800),
      calculationQuality: "adequate",
      limitations,
    },
    averageMicrophoneLevelDbfs: {
      status: "available",
      value: decibelsFullScale(-28),
      calculationQuality: "adequate",
      limitations,
    },
    peakMicrophoneLevelDbfs: {
      status: "available",
      value: decibelsFullScale(-6),
      calculationQuality: "adequate",
      limitations,
    },
    approximateWordsPerMinute: {
      status: "unavailable",
      reason: "missing-transcript",
      limitations,
    },
    speechSegments: [
      {
        startOffsetMs: milliseconds(500),
        endOffsetMs: milliseconds(4_500),
      },
    ],
    warnings: ["transcript-missing"],
  };
}

function syntheticVideoMetrics(): VideoMetrics {
  const aggregator = createVideoMetricsAggregator();
  for (let index = 0; index < 20; index += 1) {
    aggregator.addObservation({
      frameId: index,
      timestampOffsetMs: milliseconds(index * 125),
      faceCount: 1,
      primaryFaceDetected: true,
      centred: true,
      nearCameraOrientation: true,
      yawDeltaDegrees: degrees(0),
      pitchDeltaDegrees: degrees(0),
      framing: "workable",
      brightness: "balanced",
    });
  }
  return aggregator.finalize();
}

function question(suffix: string, order: number): InterviewQuestion {
  return {
    id: interviewQuestionId(`question:${suffix}`),
    source: "custom",
    text: `Describe a decision ${suffix}.`,
    normalizedText: `describe a decision ${suffix}`,
    category: "general-behavioural",
    difficulty: "standard",
    tags: ["problem-solving"],
    renderedKeywords: [],
    order,
    providerId: "test",
    providerVersion: "1",
  };
}

async function keyboardActivate(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  const control =
    screen.queryByRole("button", { name }) ??
    screen.getByRole("link", { name });
  control.focus();
  await user.keyboard("{Enter}");
  await waitFor(() => {
    expect(control).not.toHaveFocus();
  });
}

function reduce(
  state: ReturnType<typeof createInterviewStateFromDraft>,
  event: EventInput,
  nowMs = 0,
) {
  return interviewReducer(state, {
    ...event,
    nowMs,
    occurredAt: timestamp,
  });
}
