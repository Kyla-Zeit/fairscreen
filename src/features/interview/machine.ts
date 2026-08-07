import type {
  InterviewQuestionId,
  InterviewSessionId,
  IsoDateTime,
  Milliseconds,
  QuestionResponseId,
} from "../../domain/common";
import { milliseconds, questionResponseId } from "../../domain/factories";
import type {
  AnswerAnalysis,
  AudioMetrics,
  InterviewMachineStateName,
  InterviewQuestion,
  InterviewSettings,
  RecordingReference,
  TimingMode,
  TranscriptResult,
  VideoMetrics,
} from "../../domain/models";

export const INTERVIEW_MACHINE_STATES = [
  "ready",
  "preparing",
  "answering",
  "reviewing",
  "betweenQuestions",
  "complete",
] as const satisfies readonly InterviewMachineStateName[];

export type InterviewAttemptStatus =
  "awaiting-review" | "saved" | "skipped" | "interrupted";

export interface InterviewAttempt {
  readonly id: QuestionResponseId;
  readonly questionId: InterviewQuestionId;
  readonly attemptNumber: number;
  readonly status: InterviewAttemptStatus;
  readonly timingMode: TimingMode;
  readonly startedAt: IsoDateTime;
  readonly startedAtMs: number;
  readonly finishedAt?: IsoDateTime | undefined;
  readonly finishedAtMs?: number | undefined;
  readonly answerDurationMs?: Milliseconds | undefined;
  readonly notes: string;
  readonly audioMetrics?: AudioMetrics | undefined;
  readonly videoMetrics?: VideoMetrics | undefined;
  readonly recording?: RecordingReference | undefined;
  readonly transcript?: TranscriptResult | undefined;
  readonly analysis?: AnswerAnalysis | undefined;
  readonly interruptionReason?:
    "strict-time-expired" | "ended-by-user" | undefined;
}

export type InterviewDiagnosticCode =
  | "DUPLICATE_EVENT"
  | "INVALID_EVENT_FOR_STATE"
  | "NO_CURRENT_QUESTION"
  | "NO_ACTIVE_ATTEMPT"
  | "ATTEMPT_NOT_FOUND"
  | "EXTENSION_NOT_AVAILABLE"
  | "AUDIO_RESULT_NOT_ALLOWED"
  | "VIDEO_RESULT_NOT_ALLOWED"
  | "RECORDING_SAVE_NOT_ALLOWED"
  | "UNSUPPORTED_TIMER_EVENT";

export interface InterviewDiagnostic {
  readonly code: InterviewDiagnosticCode;
  readonly eventType: InterviewEvent["type"];
  readonly state: InterviewMachineStateName;
  readonly occurredAt: IsoDateTime;
}

export type InterviewCleanupReason =
  | "finish-answer"
  | "media-lost"
  | "stop-media"
  | "end-interview"
  | "recover-safe-state";

export interface InterviewCleanupEvent {
  readonly reason: InterviewCleanupReason;
  readonly state: InterviewMachineStateName;
  readonly occurredAt: IsoDateTime;
}

export type InterviewAnnouncementCode =
  | "STATE_READY"
  | "STATE_PREPARING"
  | "STATE_ANSWERING"
  | "STATE_REVIEWING"
  | "STATE_BETWEEN"
  | "STATE_COMPLETE"
  | "TIMER_30_SECONDS"
  | "TIMER_10_SECONDS"
  | "TIMER_EXPIRED"
  | "TIMER_OVERTIME"
  | "ANSWER_SAVED"
  | "QUESTION_SKIPPED"
  | "MEDIA_STOPPED"
  | "MEDIA_LOST";

export interface InterviewAnnouncement {
  readonly code: InterviewAnnouncementCode;
  readonly message: string;
  readonly occurredAt: IsoDateTime;
}

export interface InterviewMachineState {
  readonly sessionId: InterviewSessionId;
  readonly state: InterviewMachineStateName;
  readonly questions: readonly InterviewQuestion[];
  readonly settings: InterviewSettings;
  readonly currentQuestionIndex: number;
  readonly previewHidden: boolean;
  readonly timerAnnouncementsEnabled: boolean;
  readonly activeAttemptId?: QuestionResponseId | undefined;
  readonly activeStartedAtMs?: number | undefined;
  readonly activeDeadlineMs?: number | undefined;
  readonly extensionUsed: boolean;
  readonly attemptsByQuestion: Readonly<
    Record<string, readonly InterviewAttempt[]>
  >;
  readonly selectedAttemptByQuestion: Readonly<
    Record<string, QuestionResponseId>
  >;
  readonly diagnostics: readonly InterviewDiagnostic[];
  readonly cleanupEvents: readonly InterviewCleanupEvent[];
  readonly announcements: readonly InterviewAnnouncement[];
  readonly processedEventIds: readonly string[];
  readonly completedAt?: IsoDateTime | undefined;
}

export type InterviewEvent =
  | TimestampedEvent<"START_PREP">
  | TimestampedEvent<"START_ANSWER">
  | TimestampedEvent<"TIMER_EXPIRED">
  | TimestampedEvent<"EXTEND_TIME">
  | (TimestampedEvent<"SKIP_QUESTION"> & { readonly notes?: string })
  | (TimestampedEvent<"FINISH_ANSWER"> & { readonly notes: string })
  | (TimestampedEvent<"ATTACH_AUDIO_METRICS"> & {
      readonly attemptId: QuestionResponseId;
      readonly audioMetrics: AudioMetrics;
    })
  | (TimestampedEvent<"ATTACH_VIDEO_METRICS"> & {
      readonly attemptId: QuestionResponseId;
      readonly videoMetrics: VideoMetrics;
    })
  | (TimestampedEvent<"SAVE_RECORDING_REFERENCE"> & {
      readonly attemptId: QuestionResponseId;
      readonly recording: RecordingReference;
    })
  | (TimestampedEvent<"SAVE_REVIEW"> & {
      readonly notes: string;
      readonly transcript?: TranscriptResult;
      readonly analysis?: AnswerAnalysis;
      readonly recording?: RecordingReference;
    })
  | (TimestampedEvent<"REPEAT_QUESTION"> & {
      readonly notes?: string;
      readonly transcript?: TranscriptResult;
      readonly analysis?: AnswerAnalysis;
    })
  | TimestampedEvent<"NEXT_QUESTION">
  | (TimestampedEvent<"END_INTERVIEW"> & { readonly notes?: string })
  | TimestampedEvent<"MEDIA_LOST">
  | TimestampedEvent<"STOP_MEDIA">
  | (TimestampedEvent<"TOGGLE_PREVIEW"> & { readonly hidden?: boolean })
  | (TimestampedEvent<"SET_TIMER_ANNOUNCEMENTS"> & {
      readonly enabled: boolean;
    })
  | (TimestampedEvent<"SELECT_REPORT_ATTEMPT"> & {
      readonly questionId: InterviewQuestionId;
      readonly attemptId: QuestionResponseId;
    })
  | TimestampedEvent<"REOPEN_REPORT">;

interface TimestampedEvent<Type extends string> {
  readonly type: Type;
  readonly eventId?: string;
  readonly nowMs: number;
  readonly occurredAt: IsoDateTime;
}

export interface CreateInterviewMachineInput {
  readonly sessionId: InterviewSessionId;
  readonly questions: readonly InterviewQuestion[];
  readonly settings: InterviewSettings;
  readonly timerAnnouncementsEnabled?: boolean;
}

export function createInterviewMachineState({
  sessionId,
  questions,
  settings,
  timerAnnouncementsEnabled,
}: CreateInterviewMachineInput): InterviewMachineState {
  return {
    sessionId,
    state: "ready",
    questions,
    settings,
    currentQuestionIndex: 0,
    previewHidden: false,
    timerAnnouncementsEnabled:
      timerAnnouncementsEnabled ?? settings.screenReaderTimerAnnouncements,
    extensionUsed: false,
    attemptsByQuestion: {},
    selectedAttemptByQuestion: {},
    diagnostics: [],
    cleanupEvents: [],
    announcements: [],
    processedEventIds: [],
  };
}

export function interviewReducer(
  state: InterviewMachineState,
  event: InterviewEvent,
): InterviewMachineState {
  if (event.eventId && state.processedEventIds.includes(event.eventId)) {
    return invalid(state, event, "DUPLICATE_EVENT");
  }

  const withEvent = markProcessed(state, event);

  switch (event.type) {
    case "TOGGLE_PREVIEW":
      return {
        ...withEvent,
        previewHidden: event.hidden ?? !withEvent.previewHidden,
      };
    case "SET_TIMER_ANNOUNCEMENTS":
      return {
        ...withEvent,
        timerAnnouncementsEnabled: event.enabled,
      };
    case "STOP_MEDIA":
      return appendAnnouncement(
        appendCleanup(withEvent, event, "stop-media"),
        event,
        "MEDIA_STOPPED",
        "Media stopped.",
      );
    case "SELECT_REPORT_ATTEMPT":
      return selectAttempt(withEvent, event);
    case "MEDIA_LOST":
      if (withEvent.state !== "answering") {
        return invalid(withEvent, event, "INVALID_EVENT_FOR_STATE");
      }
      return appendAnnouncement(
        appendCleanup(withEvent, event, "media-lost"),
        event,
        "MEDIA_LOST",
        "Media stopped. You can continue without capture.",
      );
    case "START_PREP":
      return withEvent.state === "ready"
        ? startPreparing(withEvent, event)
        : invalid(withEvent, event, "INVALID_EVENT_FOR_STATE");
    case "START_ANSWER":
      return withEvent.state === "preparing"
        ? startAnswering(withEvent, event)
        : invalid(withEvent, event, "INVALID_EVENT_FOR_STATE");
    case "TIMER_EXPIRED":
      return handleTimerExpired(withEvent, event);
    case "EXTEND_TIME":
      return extendTime(withEvent, event);
    case "SKIP_QUESTION":
      return withEvent.state === "ready" || withEvent.state === "preparing"
        ? skipQuestion(withEvent, event)
        : invalid(withEvent, event, "INVALID_EVENT_FOR_STATE");
    case "FINISH_ANSWER":
      return withEvent.state === "answering"
        ? finishAnswer(withEvent, event, "awaiting-review")
        : invalid(withEvent, event, "INVALID_EVENT_FOR_STATE");
    case "ATTACH_AUDIO_METRICS":
      return attachAudioMetrics(withEvent, event);
    case "ATTACH_VIDEO_METRICS":
      return attachVideoMetrics(withEvent, event);
    case "SAVE_RECORDING_REFERENCE":
      return saveRecordingReference(withEvent, event);
    case "SAVE_REVIEW":
      return withEvent.state === "reviewing"
        ? saveReview(withEvent, event)
        : invalid(withEvent, event, "INVALID_EVENT_FOR_STATE");
    case "REPEAT_QUESTION":
      return withEvent.state === "reviewing"
        ? repeatQuestion(withEvent, event)
        : invalid(withEvent, event, "INVALID_EVENT_FOR_STATE");
    case "NEXT_QUESTION":
      return withEvent.state === "betweenQuestions"
        ? nextQuestion(withEvent, event)
        : invalid(withEvent, event, "INVALID_EVENT_FOR_STATE");
    case "END_INTERVIEW":
      return endInterview(withEvent, event);
    case "REOPEN_REPORT":
      return withEvent.state === "complete"
        ? withEvent
        : invalid(withEvent, event, "INVALID_EVENT_FOR_STATE");
  }
}

export function currentQuestion(
  state: InterviewMachineState,
): InterviewQuestion | undefined {
  return state.questions[state.currentQuestionIndex];
}

export function getQuestionAttempts(
  state: InterviewMachineState,
  questionId: InterviewQuestionId,
): readonly InterviewAttempt[] {
  return state.attemptsByQuestion[questionId] ?? [];
}

export function hasInProgressWork(state: InterviewMachineState): boolean {
  return ["preparing", "answering", "reviewing"].includes(state.state);
}

export function recoverToSafeInterviewState(
  state: InterviewMachineState,
  event: Pick<TimestampedEvent<"RECOVER">, "occurredAt">,
): InterviewMachineState {
  if (state.state === "complete" || state.state === "betweenQuestions") {
    return {
      ...state,
      activeAttemptId: undefined,
      activeStartedAtMs: undefined,
      activeDeadlineMs: undefined,
      extensionUsed: false,
    };
  }

  return appendCleanup(
    appendAnnouncement(
      {
        ...state,
        state: "ready",
        activeAttemptId: undefined,
        activeStartedAtMs: undefined,
        activeDeadlineMs: undefined,
        extensionUsed: false,
      },
      { occurredAt: event.occurredAt },
      "STATE_READY",
      state.questions.length > 0
        ? `Question ${state.currentQuestionIndex + 1} is ready.`
        : "Interview practice is ready.",
    ),
    { occurredAt: event.occurredAt },
    "recover-safe-state",
  );
}

function startPreparing(
  state: InterviewMachineState,
  event: InterviewEvent & { readonly type: "START_PREP" },
): InterviewMachineState {
  if (!currentQuestion(state)) {
    return invalid(state, event, "NO_CURRENT_QUESTION");
  }

  const deadline =
    state.settings.timingMode === "untimed"
      ? undefined
      : event.nowMs + state.settings.preparationTimeMs;

  return appendAnnouncement(
    {
      ...state,
      state: "preparing",
      activeStartedAtMs: event.nowMs,
      activeDeadlineMs: deadline,
      extensionUsed: false,
    },
    event,
    "STATE_PREPARING",
    `Preparation started for question ${state.currentQuestionIndex + 1}.`,
  );
}

function startAnswering(
  state: InterviewMachineState,
  event: InterviewEvent & { readonly type: "START_ANSWER" | "TIMER_EXPIRED" },
): InterviewMachineState {
  const question = currentQuestion(state);
  if (!question) {
    return invalid(state, event, "NO_CURRENT_QUESTION");
  }

  const attemptNumber = getQuestionAttempts(state, question.id).length + 1;
  const id = makeAttemptId(state.sessionId, question.id, attemptNumber);
  const attempt: InterviewAttempt = {
    id,
    questionId: question.id,
    attemptNumber,
    status: "awaiting-review",
    timingMode: state.settings.timingMode,
    startedAt: event.occurredAt,
    startedAtMs: event.nowMs,
    notes: "",
  };
  const deadline =
    state.settings.timingMode === "untimed"
      ? undefined
      : event.nowMs + state.settings.answerTimeMs;

  return appendAnnouncement(
    {
      ...state,
      state: "answering",
      activeAttemptId: id,
      activeStartedAtMs: event.nowMs,
      activeDeadlineMs: deadline,
      extensionUsed: false,
      attemptsByQuestion: appendAttempt(state, question.id, attempt),
    },
    event,
    "STATE_ANSWERING",
    `Answering started for question ${state.currentQuestionIndex + 1}.`,
  );
}

function handleTimerExpired(
  state: InterviewMachineState,
  event: InterviewEvent & { readonly type: "TIMER_EXPIRED" },
): InterviewMachineState {
  if (state.state === "preparing") {
    return startAnswering(state, event);
  }

  if (state.state !== "answering") {
    return invalid(state, event, "INVALID_EVENT_FOR_STATE");
  }

  if (state.settings.timingMode === "strictPractice") {
    return finishAnswer(state, event, "interrupted", "strict-time-expired");
  }

  if (state.settings.timingMode === "flexible") {
    return state;
  }

  return invalid(state, event, "UNSUPPORTED_TIMER_EVENT");
}

function extendTime(
  state: InterviewMachineState,
  event: InterviewEvent & { readonly type: "EXTEND_TIME" },
): InterviewMachineState {
  if (
    state.settings.timingMode === "untimed" ||
    !["preparing", "answering"].includes(state.state) ||
    state.activeDeadlineMs === undefined
  ) {
    return invalid(state, event, "EXTENSION_NOT_AVAILABLE");
  }

  if (state.extensionUsed) {
    return invalid(state, event, "EXTENSION_NOT_AVAILABLE");
  }

  return {
    ...state,
    activeDeadlineMs: state.activeDeadlineMs + state.settings.extensionTimeMs,
    extensionUsed: true,
  };
}

function skipQuestion(
  state: InterviewMachineState,
  event: InterviewEvent & { readonly type: "SKIP_QUESTION" },
): InterviewMachineState {
  const question = currentQuestion(state);
  if (!question) {
    return invalid(state, event, "NO_CURRENT_QUESTION");
  }

  const attemptNumber = getQuestionAttempts(state, question.id).length + 1;
  const attempt: InterviewAttempt = {
    id: makeAttemptId(state.sessionId, question.id, attemptNumber),
    questionId: question.id,
    attemptNumber,
    status: "skipped",
    timingMode: state.settings.timingMode,
    startedAt: event.occurredAt,
    startedAtMs: event.nowMs,
    finishedAt: event.occurredAt,
    finishedAtMs: event.nowMs,
    answerDurationMs: milliseconds(0),
    notes: event.notes ?? "",
  };

  return appendAnnouncement(
    appendCleanup(
      {
        ...state,
        state: "betweenQuestions",
        activeAttemptId: undefined,
        activeStartedAtMs: undefined,
        activeDeadlineMs: undefined,
        extensionUsed: false,
        attemptsByQuestion: appendAttempt(state, question.id, attempt),
      },
      event,
      "finish-answer",
    ),
    event,
    "QUESTION_SKIPPED",
    `Question ${state.currentQuestionIndex + 1} skipped.`,
  );
}

function finishAnswer(
  state: InterviewMachineState,
  event:
    | (InterviewEvent & { readonly type: "FINISH_ANSWER" })
    | TimestampedEvent<"TIMER_EXPIRED">,
  status: "awaiting-review" | "interrupted",
  interruptionReason?: InterviewAttempt["interruptionReason"],
): InterviewMachineState {
  if (!state.activeAttemptId || state.activeStartedAtMs === undefined) {
    return invalid(state, event, "NO_ACTIVE_ATTEMPT");
  }

  const question = currentQuestion(state);
  if (!question) {
    return invalid(state, event, "NO_CURRENT_QUESTION");
  }

  const duration = Math.max(0, event.nowMs - state.activeStartedAtMs);
  const notes = "notes" in event ? event.notes : "";
  const updated = updateAttempt(state, question.id, state.activeAttemptId, {
    status,
    finishedAt: event.occurredAt,
    finishedAtMs: event.nowMs,
    answerDurationMs: milliseconds(duration),
    notes,
    ...(interruptionReason ? { interruptionReason } : {}),
  });

  if (!updated) {
    return invalid(state, event, "ATTEMPT_NOT_FOUND");
  }

  return appendAnnouncement(
    appendCleanup(
      {
        ...state,
        state: "reviewing",
        activeStartedAtMs: undefined,
        activeDeadlineMs: undefined,
        extensionUsed: false,
        attemptsByQuestion: updated,
      },
      event,
      "finish-answer",
    ),
    event,
    "STATE_REVIEWING",
    `Review answer for question ${state.currentQuestionIndex + 1}.`,
  );
}

function saveReview(
  state: InterviewMachineState,
  event: InterviewEvent & { readonly type: "SAVE_REVIEW" },
): InterviewMachineState {
  const question = currentQuestion(state);
  if (!question || !state.activeAttemptId) {
    return invalid(state, event, "NO_ACTIVE_ATTEMPT");
  }

  const updated = updateAttempt(state, question.id, state.activeAttemptId, {
    status: "saved",
    notes: event.notes,
    ...(event.transcript ? { transcript: event.transcript } : {}),
    ...(event.analysis ? { analysis: event.analysis } : {}),
    ...(event.recording ? { recording: event.recording } : {}),
  });

  if (!updated) {
    return invalid(state, event, "ATTEMPT_NOT_FOUND");
  }

  return appendAnnouncement(
    {
      ...state,
      state: "betweenQuestions",
      activeAttemptId: undefined,
      activeStartedAtMs: undefined,
      activeDeadlineMs: undefined,
      extensionUsed: false,
      attemptsByQuestion: updated,
    },
    event,
    "ANSWER_SAVED",
    "Answer saved locally. The next question is ready when you are.",
  );
}

function attachAudioMetrics(
  state: InterviewMachineState,
  event: InterviewEvent & { readonly type: "ATTACH_AUDIO_METRICS" },
): InterviewMachineState {
  if (state.state !== "reviewing") {
    return invalid(state, event, "AUDIO_RESULT_NOT_ALLOWED");
  }

  const question = currentQuestion(state);
  if (!question || state.activeAttemptId !== event.attemptId) {
    return invalid(state, event, "ATTEMPT_NOT_FOUND");
  }

  const updated = updateAttempt(state, question.id, event.attemptId, {
    audioMetrics: event.audioMetrics,
  });

  if (!updated) {
    return invalid(state, event, "ATTEMPT_NOT_FOUND");
  }

  return {
    ...state,
    attemptsByQuestion: updated,
  };
}

function attachVideoMetrics(
  state: InterviewMachineState,
  event: InterviewEvent & { readonly type: "ATTACH_VIDEO_METRICS" },
): InterviewMachineState {
  if (state.state !== "reviewing") {
    return invalid(state, event, "VIDEO_RESULT_NOT_ALLOWED");
  }

  const question = currentQuestion(state);
  if (!question || state.activeAttemptId !== event.attemptId) {
    return invalid(state, event, "ATTEMPT_NOT_FOUND");
  }

  const updated = updateAttempt(state, question.id, event.attemptId, {
    videoMetrics: event.videoMetrics,
  });

  if (!updated) {
    return invalid(state, event, "ATTEMPT_NOT_FOUND");
  }

  return {
    ...state,
    attemptsByQuestion: updated,
  };
}

function saveRecordingReference(
  state: InterviewMachineState,
  event: InterviewEvent & { readonly type: "SAVE_RECORDING_REFERENCE" },
): InterviewMachineState {
  if (state.state !== "reviewing") {
    return invalid(state, event, "RECORDING_SAVE_NOT_ALLOWED");
  }

  const question = currentQuestion(state);
  if (!question || state.activeAttemptId !== event.attemptId) {
    return invalid(state, event, "ATTEMPT_NOT_FOUND");
  }

  const updated = updateAttempt(state, question.id, event.attemptId, {
    recording: event.recording,
  });

  if (!updated) {
    return invalid(state, event, "ATTEMPT_NOT_FOUND");
  }

  return {
    ...state,
    attemptsByQuestion: updated,
  };
}

function repeatQuestion(
  state: InterviewMachineState,
  event: InterviewEvent & { readonly type: "REPEAT_QUESTION" },
): InterviewMachineState {
  const question = currentQuestion(state);
  if (!question || !state.activeAttemptId) {
    return invalid(state, event, "NO_ACTIVE_ATTEMPT");
  }

  const updated = updateAttempt(state, question.id, state.activeAttemptId, {
    status: "saved",
    notes: event.notes ?? latestActiveAttempt(state)?.notes ?? "",
    ...(event.transcript ? { transcript: event.transcript } : {}),
    ...(event.analysis ? { analysis: event.analysis } : {}),
  });

  if (!updated) {
    return invalid(state, event, "ATTEMPT_NOT_FOUND");
  }

  return appendAnnouncement(
    {
      ...state,
      state: "preparing",
      activeAttemptId: undefined,
      activeStartedAtMs: event.nowMs,
      activeDeadlineMs:
        state.settings.timingMode === "untimed"
          ? undefined
          : event.nowMs + state.settings.preparationTimeMs,
      extensionUsed: false,
      attemptsByQuestion: updated,
    },
    event,
    "STATE_PREPARING",
    `Preparation restarted for question ${state.currentQuestionIndex + 1}.`,
  );
}

function nextQuestion(
  state: InterviewMachineState,
  event: InterviewEvent & { readonly type: "NEXT_QUESTION" },
): InterviewMachineState {
  const nextIndex = state.currentQuestionIndex + 1;
  if (nextIndex >= state.questions.length) {
    return completeState(state, event);
  }

  return appendAnnouncement(
    {
      ...state,
      state: "ready",
      currentQuestionIndex: nextIndex,
      activeAttemptId: undefined,
      activeStartedAtMs: undefined,
      activeDeadlineMs: undefined,
      extensionUsed: false,
    },
    event,
    "STATE_READY",
    `Question ${nextIndex + 1} is ready.`,
  );
}

function endInterview(
  state: InterviewMachineState,
  event: InterviewEvent & { readonly type: "END_INTERVIEW" },
): InterviewMachineState {
  if (state.state === "complete") {
    return state;
  }

  const withInterruptedAttempt =
    state.state === "answering" && state.activeAttemptId
      ? finishActiveAsInterrupted(state, event)
      : state;

  return completeState(
    appendCleanup(withInterruptedAttempt, event, "end-interview"),
    event,
  );
}

function completeState(
  state: InterviewMachineState,
  event: Pick<TimestampedEvent<"COMPLETE">, "occurredAt">,
): InterviewMachineState {
  return appendAnnouncement(
    {
      ...state,
      state: "complete",
      currentQuestionIndex: Math.min(
        state.currentQuestionIndex,
        state.questions.length,
      ),
      activeAttemptId: undefined,
      activeStartedAtMs: undefined,
      activeDeadlineMs: undefined,
      extensionUsed: false,
      completedAt: event.occurredAt,
    },
    { occurredAt: event.occurredAt },
    "STATE_COMPLETE",
    "Practice complete.",
  );
}

function finishActiveAsInterrupted(
  state: InterviewMachineState,
  event: InterviewEvent & { readonly type: "END_INTERVIEW" },
): InterviewMachineState {
  const question = currentQuestion(state);
  if (
    !question ||
    !state.activeAttemptId ||
    state.activeStartedAtMs === undefined
  ) {
    return state;
  }

  const updated = updateAttempt(state, question.id, state.activeAttemptId, {
    status: "interrupted",
    finishedAt: event.occurredAt,
    finishedAtMs: event.nowMs,
    answerDurationMs: milliseconds(
      Math.max(0, event.nowMs - state.activeStartedAtMs),
    ),
    notes: event.notes ?? "",
    interruptionReason: "ended-by-user",
  });

  return updated
    ? {
        ...state,
        attemptsByQuestion: updated,
      }
    : state;
}

function selectAttempt(
  state: InterviewMachineState,
  event: InterviewEvent & { readonly type: "SELECT_REPORT_ATTEMPT" },
): InterviewMachineState {
  const attempts = getQuestionAttempts(state, event.questionId);
  if (!attempts.some((attempt) => attempt.id === event.attemptId)) {
    return invalid(state, event, "ATTEMPT_NOT_FOUND");
  }

  return {
    ...state,
    selectedAttemptByQuestion: {
      ...state.selectedAttemptByQuestion,
      [event.questionId]: event.attemptId,
    },
  };
}

function appendAttempt(
  state: InterviewMachineState,
  questionId: InterviewQuestionId,
  attempt: InterviewAttempt,
): Record<string, readonly InterviewAttempt[]> {
  return {
    ...state.attemptsByQuestion,
    [questionId]: [...getQuestionAttempts(state, questionId), attempt],
  };
}

function updateAttempt(
  state: InterviewMachineState,
  questionId: InterviewQuestionId,
  attemptId: QuestionResponseId,
  update: Partial<InterviewAttempt>,
): Record<string, readonly InterviewAttempt[]> | undefined {
  const attempts = getQuestionAttempts(state, questionId);
  const attemptIndex = attempts.findIndex(
    (attempt) => attempt.id === attemptId,
  );
  if (attemptIndex < 0) {
    return undefined;
  }

  const nextAttempts = attempts.map((attempt) => {
    if (attempt.id !== attemptId) {
      return attempt;
    }
    return { ...attempt, ...update };
  });

  return {
    ...state.attemptsByQuestion,
    [questionId]: nextAttempts,
  };
}

function latestActiveAttempt(state: InterviewMachineState) {
  const question = currentQuestion(state);
  if (!question || !state.activeAttemptId) {
    return undefined;
  }
  return getQuestionAttempts(state, question.id).find(
    (attempt) => attempt.id === state.activeAttemptId,
  );
}

function appendCleanup(
  state: InterviewMachineState,
  event: Pick<InterviewEvent, "occurredAt">,
  reason: InterviewCleanupReason,
): InterviewMachineState {
  return {
    ...state,
    cleanupEvents: [
      ...state.cleanupEvents,
      { reason, state: state.state, occurredAt: event.occurredAt },
    ],
  };
}

function appendAnnouncement(
  state: InterviewMachineState,
  event: Pick<InterviewEvent, "occurredAt">,
  code: InterviewAnnouncementCode,
  message: string,
): InterviewMachineState {
  return {
    ...state,
    announcements: [
      ...state.announcements,
      { code, message, occurredAt: event.occurredAt },
    ],
  };
}

function invalid(
  state: InterviewMachineState,
  event: Pick<InterviewEvent, "occurredAt" | "type">,
  code: InterviewDiagnosticCode,
): InterviewMachineState {
  return {
    ...state,
    diagnostics: [
      ...state.diagnostics,
      {
        code,
        eventType: event.type,
        state: state.state,
        occurredAt: event.occurredAt,
      },
    ],
  };
}

function markProcessed(
  state: InterviewMachineState,
  event: InterviewEvent,
): InterviewMachineState {
  if (!event.eventId) {
    return state;
  }

  return {
    ...state,
    processedEventIds: [...state.processedEventIds, event.eventId].slice(-20),
  };
}

function makeAttemptId(
  sessionId: InterviewSessionId,
  questionId: InterviewQuestionId,
  attemptNumber: number,
): QuestionResponseId {
  const normalizedQuestionId = String(questionId)
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-");
  return questionResponseId(
    `response:${String(sessionId)}:${normalizedQuestionId}:attempt-${attemptNumber}`,
  );
}
