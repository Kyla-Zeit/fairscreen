import type { IsoDateTime } from "../../domain/common";
import { createExportFilename } from "../../domain/filenames";
import { isoDate, milliseconds } from "../../domain/factories";
import type {
  InterviewSession,
  InterviewSessionStatus,
  QuestionResponse,
} from "../../domain/models";
import type { InterviewAttempt } from "../interview/machine";
import type { InterviewProgressRecord } from "../interview/progressPersistence";
import { createFreshSessionSeed, type SetupDraft } from "../setup/setupDraft";

const COMPLETED_RESPONSE_STATUSES = new Set([
  "saved",
  "skipped",
  "interrupted",
  "reviewed",
]);

export function completedQuestionCount(
  responses: readonly QuestionResponse[],
): number {
  return new Set(
    responses
      .filter((response) => COMPLETED_RESPONSE_STATUSES.has(response.status))
      .map((response) => response.question.id),
  ).size;
}

export function effectiveSessionStatus(
  session: InterviewSession,
  responses: readonly QuestionResponse[],
): InterviewSessionStatus {
  const completed = completedQuestionCount(responses);
  if (session.status === "complete" && completed < session.questions.length) {
    return "ended-early";
  }
  return session.status;
}

export function setupDraftFromSession(
  session: InterviewSession,
  options: { readonly freshSession?: boolean } = {},
): SetupDraft {
  const settings = session.settingsSnapshot;
  const sessionSeed = options.freshSession
    ? createFreshSessionSeed()
    : seedFromSessionId(String(session.id));

  return {
    sessionSeed,
    jobTitle: session.context.jobTitle,
    company: session.context.company ?? "",
    companyWebsiteUrl: session.context.companyWebsiteUrl ?? "",
    ...(session.context.companyWebsiteUrl
      ? { normalizedCompanyWebsiteUrl: session.context.companyWebsiteUrl }
      : {}),
    jobPostingUrl: session.context.jobPostingUrl ?? "",
    ...(session.context.jobPostingUrl
      ? { normalizedJobPostingUrl: session.context.jobPostingUrl }
      : {}),
    jobDescription: session.context.jobDescription ?? "",
    resumeText: session.context.resumeText ?? "",
    category: session.context.category,
    difficulty: session.context.difficulty,
    questionCount: session.questions.length,
    preparationTimeSeconds: Math.round(settings.preparationTimeMs / 1000),
    answerTimeSeconds: Math.round(settings.answerTimeMs / 1000),
    timingMode: settings.timingMode,
    liveCoaching: settings.liveCoaching,
    transcription: settings.transcription,
    cameraRequested: settings.cameraRequested,
    microphoneRequested: settings.microphoneRequested,
    recordingCaptureRequested: settings.recordingCaptureRequested,
    customQuestions: session.questions
      .filter((question) => question.source === "custom")
      .map((question) => question.text),
    generatedQuestions: session.questions,
    extractedKeywords: session.extractedKeywords,
    questionSelectionReasons: [],
    storageMode: "persistent",
  };
}

export function progressFromStoredSession(
  session: InterviewSession,
  responses: readonly QuestionResponse[],
): InterviewProgressRecord {
  const attemptsByQuestion = Object.fromEntries(
    session.questions.map((question) => [
      question.id,
      responses
        .filter((response) => response.question.id === question.id)
        .sort((left, right) => left.attemptNumber - right.attemptNumber)
        .map(responseToAttempt),
    ]),
  );

  const effectiveStatus = effectiveSessionStatus(session, responses);
  const currentQuestion = session.questions[session.currentQuestionIndex];
  const currentQuestionWasCompleted = currentQuestion
    ? responses.some(
        (response) =>
          response.question.id === currentQuestion.id &&
          COMPLETED_RESPONSE_STATUSES.has(response.status),
      )
    : false;
  const safeState: InterviewProgressRecord["state"] =
    effectiveStatus === "complete" ||
    session.currentQuestionIndex >= session.questions.length
      ? "complete"
      : session.safeMachineState === "betweenQuestions" ||
          currentQuestionWasCompleted
        ? "betweenQuestions"
        : "ready";

  return {
    schemaVersion: 1,
    sessionId: session.id,
    state: safeState,
    questions: session.questions,
    settings: session.settingsSnapshot,
    currentQuestionIndex: Math.min(
      session.currentQuestionIndex,
      session.questions.length,
    ),
    previewHidden: false,
    timerAnnouncementsEnabled:
      session.settingsSnapshot.screenReaderTimerAnnouncements,
    attemptsByQuestion,
    selectedAttemptByQuestion: session.selectedAttemptByQuestion,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    ...(session.completedAt ? { completedAt: session.completedAt } : {}),
  };
}

export function downloadSessionJson(
  session: InterviewSession,
  responses: readonly QuestionResponse[],
): void {
  const exportedAt = new Date().toISOString() as IsoDateTime;
  const payload = {
    format: "fairscreen-export",
    exportSchemaVersion: 1,
    exportedAt,
    appVersion: "0.11.0",
    kind: "session",
    includedFields: [
      "session-context",
      "reviewed-transcripts",
      "content-coaching",
      "timing-audio-metrics",
      "video-conditions",
      "notes",
    ],
    warning:
      "FairScreen is practice software. This export is not an employer assessment, score, rank, or hiring recommendation. Recordings are excluded.",
    data: {
      session: withoutRecordingReferences(session),
      responses: responses.map(withoutRecordingReference),
    },
  };

  downloadText(
    JSON.stringify(payload, null, 2),
    exportFilename(session, "json"),
    "application/json",
  );
}

export function downloadSessionText(
  session: InterviewSession,
  responses: readonly QuestionResponse[],
): void {
  const lines: string[] = [
    "FairScreen practice report",
    "==========================",
    "",
    `Session: ${session.displayName ?? session.context.jobTitle}`,
    `Job title: ${session.context.jobTitle}`,
    ...(session.context.company ? [`Company: ${session.context.company}`] : []),
    `Status: ${session.status}`,
    `Created: ${formatDateTime(session.createdAt)}`,
    `Updated: ${formatDateTime(session.updatedAt)}`,
    "",
    "FairScreen is practice software, not an employer assessment. It does not provide a hiring score, rank, or recommendation.",
    "Recordings are not included in this export.",
    "",
  ];

  session.questions.forEach((question, questionIndex) => {
    lines.push(`Question ${questionIndex + 1}: ${question.text}`, "");
    const attempts = responses
      .filter((response) => response.question.id === question.id)
      .sort((left, right) => left.attemptNumber - right.attemptNumber);

    if (attempts.length === 0) {
      lines.push("No saved attempt.", "");
      return;
    }

    attempts.forEach((response) => {
      lines.push(`Attempt ${response.attemptNumber} (${response.status})`);
      const transcript = response.transcript.activeRevision;
      lines.push(
        transcript
          ? `Reviewed transcript:\n${transcript.text}`
          : "Reviewed transcript: Not available",
      );
      if (response.analysis) {
        lines.push(`Coaching summary: ${response.analysis.summary}`);
        if (response.analysis.detectedStrengths.length > 0) {
          lines.push(
            `Strengths: ${response.analysis.detectedStrengths.join("; ")}`,
          );
        }
        if (response.analysis.suggestedImprovements.length > 0) {
          lines.push(
            `Suggestions: ${response.analysis.suggestedImprovements.join("; ")}`,
          );
        }
      }
      if (
        response.userNotes &&
        (!transcript || !sameReadableText(response.userNotes, transcript.text))
      ) {
        lines.push(`Notes: ${response.userNotes}`);
      }
      lines.push("");
    });
  });

  if (session.userNotes) {
    lines.push("Session notes", "-------------", session.userNotes, "");
  }

  downloadText(
    lines.join("\n"),
    exportFilename(session, "txt"),
    "text/plain;charset=utf-8",
  );
}

function sameReadableText(left: string, right: string): boolean {
  const normalize = (value: string) =>
    value.trim().replaceAll(/\s+/g, " ").toLocaleLowerCase("en-CA");
  return normalize(left) === normalize(right);
}

function responseToAttempt(response: QuestionResponse): InterviewAttempt {
  const startedAt = response.startedAt ?? response.createdAt;
  return {
    id: response.id,
    questionId: response.question.id,
    attemptNumber: response.attemptNumber,
    status:
      response.status === "skipped"
        ? "skipped"
        : response.status === "interrupted"
          ? "interrupted"
          : "saved",
    timingMode: response.timingMode,
    startedAt,
    startedAtMs: 0,
    ...(response.finishedAt ? { finishedAt: response.finishedAt } : {}),
    ...(response.finishedAt
      ? { finishedAtMs: response.answerDurationMs ?? 0 }
      : {}),
    ...(response.answerDurationMs === undefined
      ? {}
      : { answerDurationMs: milliseconds(response.answerDurationMs) }),
    notes: response.userNotes ?? "",
    ...(response.audioMetrics ? { audioMetrics: response.audioMetrics } : {}),
    ...(response.videoMetrics ? { videoMetrics: response.videoMetrics } : {}),
    ...(response.recording ? { recording: response.recording } : {}),
    transcript: response.transcript,
    ...(response.analysis ? { analysis: response.analysis } : {}),
    ...(response.interruptionReason === "strict-time-expired" ||
    response.interruptionReason === "ended-by-user"
      ? { interruptionReason: response.interruptionReason }
      : {}),
  };
}

function seedFromSessionId(sessionId: string): string {
  const segments = sessionId.split(":");
  return segments.at(-1) ?? "saved";
}

function withoutRecordingReference(response: QuestionResponse) {
  const { recording, ...safeResponse } = response;
  void recording;
  return safeResponse;
}

function withoutRecordingReferences(session: InterviewSession) {
  return session;
}

function exportFilename(
  session: InterviewSession,
  format: "txt" | "json",
): string {
  const date = isoDate(new Date().toISOString().slice(0, 10));
  return createExportFilename(
    "session",
    date,
    format,
    session.displayName ?? session.context.jobTitle,
  );
}

function downloadText(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
