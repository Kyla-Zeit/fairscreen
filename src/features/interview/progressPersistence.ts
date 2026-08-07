import type {
  AlgorithmVersions,
  InterviewQuestionId,
  InterviewSessionId,
  IsoDateTime,
  QuestionResponseId,
} from "../../domain/common";
import { interviewSessionId, milliseconds } from "../../domain/factories";
import type {
  InterviewContext,
  InterviewMachineStateName,
  InterviewQuestion,
  InterviewSession,
  InterviewSessionStatus,
  InterviewSettings,
  QuestionResponse,
  ResponseStatus,
} from "../../domain/models";
import type { FairScreenRepository, StorageResult } from "../../domain/ports";
import type { SetupDraft } from "../setup/setupDraft";
import {
  sanitizeSessionSeed,
  toInterviewContext,
  toInterviewSettings,
} from "../setup/setupDraft";
import { AUDIO_METRIC_ALGORITHM_VERSION } from "../audio/audioMetrics";
import { VIDEO_METRIC_ALGORITHM_VERSION } from "../video/conditions";
import {
  createInterviewMachineState,
  type InterviewAttempt,
  type InterviewMachineState,
} from "./machine";

export const FAIRSCREEN_ALGORITHMS: AlgorithmVersions = Object.freeze({
  questionProvider: "m05-local-deterministic",
  keywordExtractor: "m05-local-keyword-extractor",
  audioMetrics: AUDIO_METRIC_ALGORITHM_VERSION,
  videoMetrics: VIDEO_METRIC_ALGORITHM_VERSION,
  answerHeuristics: "m11.8-deterministic-coaching-v3",
  fairnessSimilarity: "not-implemented-m06",
});

export interface InterviewProgressRecord {
  readonly schemaVersion: 1;
  readonly sessionId: InterviewSessionId;
  readonly state: Exclude<
    InterviewMachineStateName,
    "preparing" | "answering" | "reviewing"
  >;
  readonly questions: readonly InterviewQuestion[];
  readonly settings: InterviewSettings;
  readonly currentQuestionIndex: number;
  readonly previewHidden: boolean;
  readonly timerAnnouncementsEnabled: boolean;
  readonly attemptsByQuestion: Readonly<
    Record<string, readonly InterviewAttempt[]>
  >;
  readonly selectedAttemptByQuestion: Readonly<
    Record<string, QuestionResponseId>
  >;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly completedAt?: IsoDateTime | undefined;
}

export interface ProgressProjectionInput {
  readonly state: InterviewMachineState;
  readonly context: InterviewContext;
  readonly extractedKeywords: InterviewSession["extractedKeywords"];
  readonly algorithms?: AlgorithmVersions;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly isDemo?: boolean;
}

export function createSessionIdFromDraft(
  draft: SetupDraft,
): InterviewSessionId {
  const title = draft.jobTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const suffix = title.length > 0 ? title.slice(0, 48) : "draft";
  return interviewSessionId(
    `session:${suffix}:${sanitizeSessionSeed(draft.sessionSeed)}`,
  );
}

export function createInterviewStateFromDraft(
  draft: SetupDraft,
  sessionId = createSessionIdFromDraft(draft),
): InterviewMachineState {
  return createInterviewMachineState({
    sessionId,
    questions: draft.generatedQuestions,
    settings: toInterviewSettings(draft),
  });
}

export function serializeInterviewProgress(
  state: InterviewMachineState,
  updatedAt: IsoDateTime,
  createdAt: IsoDateTime = updatedAt,
): InterviewProgressRecord {
  const safeState = coerceToReloadState(state.state);

  return {
    schemaVersion: 1,
    sessionId: state.sessionId,
    state: safeState,
    questions: state.questions,
    settings: state.settings,
    currentQuestionIndex: state.currentQuestionIndex,
    previewHidden: state.previewHidden,
    timerAnnouncementsEnabled: state.timerAnnouncementsEnabled,
    attemptsByQuestion: state.attemptsByQuestion,
    selectedAttemptByQuestion: state.selectedAttemptByQuestion,
    createdAt,
    updatedAt,
    ...(state.completedAt ? { completedAt: state.completedAt } : {}),
  };
}

export function recoverInterviewProgress(
  progress: InterviewProgressRecord,
): InterviewMachineState {
  return {
    ...createInterviewMachineState({
      sessionId: progress.sessionId,
      questions: progress.questions,
      settings: progress.settings,
      timerAnnouncementsEnabled: progress.timerAnnouncementsEnabled,
    }),
    state: progress.state,
    currentQuestionIndex: Math.min(
      progress.currentQuestionIndex,
      progress.questions.length,
    ),
    previewHidden: progress.previewHidden,
    attemptsByQuestion: progress.attemptsByQuestion,
    selectedAttemptByQuestion: progress.selectedAttemptByQuestion,
    ...(progress.completedAt ? { completedAt: progress.completedAt } : {}),
  };
}

export function projectInterviewProgress({
  state,
  context,
  extractedKeywords,
  algorithms = FAIRSCREEN_ALGORITHMS,
  createdAt,
  updatedAt,
  isDemo = false,
}: ProgressProjectionInput): {
  readonly session: InterviewSession;
  readonly responses: readonly QuestionResponse[];
} {
  const responses = createResponseRecords(state, updatedAt);
  const responseIds = responses.map((response) => response.id);
  const responseIdSet = new Set(responseIds);
  const selectedAttemptByQuestion = Object.fromEntries(
    Object.entries(state.selectedAttemptByQuestion).filter(([, responseId]) =>
      responseIdSet.has(responseId),
    ),
  ) as Readonly<Record<InterviewQuestionId, QuestionResponseId>>;

  const session: InterviewSession = {
    schemaVersion: 1,
    id: state.sessionId,
    status: statusForState(state),
    context,
    settingsSnapshot: state.settings,
    questions: state.questions,
    responseIds,
    currentQuestionIndex: state.currentQuestionIndex,
    safeMachineState: safeMachineStateForDomain(state.state),
    selectedAttemptByQuestion,
    extractedKeywords,
    algorithms,
    ...(state.completedAt ? { completedAt: state.completedAt } : {}),
    isDemo,
    createdAt,
    updatedAt,
  };

  return { session, responses };
}

export async function saveInterviewProgress(
  repository: FairScreenRepository,
  projection: ReturnType<typeof projectInterviewProgress>,
): Promise<StorageResult<void>> {
  for (const response of projection.responses) {
    const saved = await repository.saveResponse(response);
    if (!saved.ok) {
      return saved;
    }
  }

  const sessionSaved = await repository.saveSession(projection.session);
  if (!sessionSaved.ok) return sessionSaved;

  const sessionReadback = await repository.getSession(projection.session.id);
  if (!sessionReadback.ok) return sessionReadback;
  if (!sessionReadback.value) {
    return storageVerificationFailure("verify-saved-session");
  }
  if (
    sessionReadback.value.status !== projection.session.status ||
    sessionReadback.value.currentQuestionIndex !==
      projection.session.currentQuestionIndex ||
    !sameStringSet(
      sessionReadback.value.responseIds,
      projection.session.responseIds,
    )
  ) {
    return storageVerificationFailure("verify-saved-session-content");
  }

  const responsesReadback = await repository.listResponses(
    projection.session.id,
  );
  if (!responsesReadback.ok) return responsesReadback;
  const savedById = new Map(
    responsesReadback.value.map((response) => [response.id, response]),
  );
  for (const expected of projection.responses) {
    const saved = savedById.get(expected.id);
    if (!saved) {
      return storageVerificationFailure("verify-saved-responses");
    }
    if (!sameSavedResponse(expected, saved)) {
      return storageVerificationFailure("verify-saved-response-content");
    }
  }

  return { ok: true, value: undefined };
}

function sameStringSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function sameSavedResponse(
  expected: QuestionResponse,
  saved: QuestionResponse,
): boolean {
  return (
    saved.status === expected.status &&
    saved.updatedAt === expected.updatedAt &&
    saved.transcript.activeRevision?.normalizedDigest ===
      expected.transcript.activeRevision?.normalizedDigest &&
    saved.analysis?.transcriptDigest === expected.analysis?.transcriptDigest &&
    saved.recording?.id === expected.recording?.id &&
    saved.recording?.sizeBytes === expected.recording?.sizeBytes &&
    saved.userNotes === expected.userNotes
  );
}

function storageVerificationFailure(operation: string): StorageResult<void> {
  return {
    ok: false,
    error: {
      code: "transaction-aborted",
      operation,
      recoverable: true,
      actions: ["retry", "export"],
    },
  };
}

export function createProjectionInputFromDraft(
  draft: SetupDraft,
  state: InterviewMachineState,
  timestamp: IsoDateTime,
): ProgressProjectionInput {
  return {
    state,
    context: toInterviewContext({
      ...draft,
      jobTitle: draft.jobTitle.trim() || "Practice interview",
    }),
    extractedKeywords: draft.extractedKeywords,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createResponseRecords(
  state: InterviewMachineState,
  updatedAt: IsoDateTime,
): readonly QuestionResponse[] {
  return Object.values(state.attemptsByQuestion)
    .flat()
    .filter((attempt) => attempt.status !== "awaiting-review")
    .map((attempt) => {
      const question = state.questions.find(
        (candidate) => candidate.id === attempt.questionId,
      );
      if (!question) {
        throw new Error("response-question-missing");
      }

      return {
        schemaVersion: 1,
        id: attempt.id,
        sessionId: state.sessionId,
        question,
        attemptNumber: attempt.attemptNumber,
        status: toResponseStatus(attempt.status),
        ...(attempt.startedAt ? { startedAt: attempt.startedAt } : {}),
        ...(attempt.finishedAt ? { finishedAt: attempt.finishedAt } : {}),
        ...(attempt.answerDurationMs === undefined
          ? {}
          : { answerDurationMs: milliseconds(attempt.answerDurationMs) }),
        timingMode: attempt.timingMode,
        transcript: attempt.transcript ?? {
          status: "timing-only",
          providerId: "no-transcription",
          processingMode: "unknown",
          revisions: [],
          errors: [],
          limitations: ["No reviewed transcript was saved for this answer."],
        },
        ...(attempt.notes.trim().length > 0
          ? { userNotes: attempt.notes.trim() }
          : {}),
        ...(attempt.audioMetrics ? { audioMetrics: attempt.audioMetrics } : {}),
        ...(attempt.videoMetrics ? { videoMetrics: attempt.videoMetrics } : {}),
        ...(analysisMatchesTranscript(attempt.transcript, attempt.analysis)
          ? { analysis: attempt.analysis }
          : {}),
        ...(attempt.recording ? { recording: attempt.recording } : {}),
        ...(attempt.interruptionReason
          ? { interruptionReason: attempt.interruptionReason }
          : {}),
        createdAt: attempt.startedAt,
        updatedAt,
      } satisfies QuestionResponse;
    });
}

function analysisMatchesTranscript(
  transcript: QuestionResponse["transcript"] | undefined,
  analysis: QuestionResponse["analysis"] | undefined,
): analysis is NonNullable<QuestionResponse["analysis"]> {
  const revision = transcript?.activeRevision;
  return (
    revision?.reviewedByUser === true &&
    analysis?.transcriptRevisionId === revision.id &&
    analysis.transcriptDigest === revision.normalizedDigest
  );
}

function coerceToReloadState(
  state: InterviewMachineStateName,
): InterviewProgressRecord["state"] {
  if (state === "complete") {
    return "complete";
  }

  if (state === "betweenQuestions") {
    return "betweenQuestions";
  }

  return "ready";
}

function safeMachineStateForDomain(
  state: InterviewMachineStateName,
): InterviewSession["safeMachineState"] {
  if (state === "complete") {
    return "complete";
  }

  if (state === "betweenQuestions") {
    return "betweenQuestions";
  }

  if (state === "reviewing") {
    return "reviewing";
  }

  return "ready";
}

function statusForState(state: InterviewMachineState): InterviewSessionStatus {
  switch (state.state) {
    case "complete":
      return completedQuestionCount(state) >= state.questions.length
        ? "complete"
        : "ended-early";
    case "reviewing":
      return "awaiting-review";
    case "ready":
      return "ready";
    case "preparing":
    case "answering":
    case "betweenQuestions":
      return "in-progress";
  }
}

function completedQuestionCount(state: InterviewMachineState): number {
  return Object.values(state.attemptsByQuestion).filter((attempts) =>
    attempts.some((attempt) =>
      ["saved", "skipped", "interrupted"].includes(attempt.status),
    ),
  ).length;
}

function toResponseStatus(status: InterviewAttempt["status"]): ResponseStatus {
  if (status === "awaiting-review") {
    return "awaiting-review";
  }

  return status;
}
