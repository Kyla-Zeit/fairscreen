import type { InterviewQuestionId, QuestionResponseId } from "./common";
import type {
  FairnessComparison,
  InterviewSession,
  InterviewSettings,
  QuestionResponse,
} from "./models";

export const APPROVED_INVARIANT_MESSAGE =
  "The answer content remained unchanged. Differences in video conditions should not be interpreted as differences in competence.";

export class DomainInvariantError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`FairScreen domain invariant failed: ${code}.`);
    this.name = "DomainInvariantError";
    this.code = code;
  }
}

export function validateInterviewSettings(
  settings: InterviewSettings,
): InterviewSettings {
  if (
    !Number.isSafeInteger(settings.questionCount) ||
    settings.questionCount < 1 ||
    settings.questionCount > 10
  ) {
    throw new DomainInvariantError("settings-question-count");
  }

  if (settings.preparationTimeMs > 600_000) {
    throw new DomainInvariantError("settings-preparation-time");
  }

  if (settings.answerTimeMs < 30_000 || settings.answerTimeMs > 1_200_000) {
    throw new DomainInvariantError("settings-answer-time");
  }

  if (settings.extensionTimeMs < 10_000 || settings.extensionTimeMs > 600_000) {
    throw new DomainInvariantError("settings-extension-time");
  }

  return settings;
}

export function snapshotInterviewSettings(
  settings: InterviewSettings,
): InterviewSettings {
  validateInterviewSettings(settings);
  return Object.freeze({ ...settings });
}

export function validateSession(session: InterviewSession): InterviewSession {
  const questionIds = new Set<string>();
  for (const [index, question] of session.questions.entries()) {
    if (question.order !== index) {
      throw new DomainInvariantError("session-question-order");
    }
    if (questionIds.has(question.id)) {
      throw new DomainInvariantError("session-question-id-duplicate");
    }
    questionIds.add(question.id);
  }

  if (
    session.currentQuestionIndex < 0 ||
    session.currentQuestionIndex > session.questions.length
  ) {
    throw new DomainInvariantError("session-current-question-index");
  }

  if (
    session.status === "complete" &&
    session.safeMachineState !== "complete"
  ) {
    throw new DomainInvariantError("session-complete-machine-state");
  }

  validateInterviewSettings(session.settingsSnapshot);
  return session;
}

export function validateResponse(response: QuestionResponse): QuestionResponse {
  if (
    !Number.isSafeInteger(response.attemptNumber) ||
    response.attemptNumber < 1
  ) {
    throw new DomainInvariantError("response-attempt-number");
  }

  const activeRevision = response.transcript.activeRevision;
  if (response.analysis) {
    if (
      !activeRevision?.reviewedByUser ||
      response.analysis.transcriptRevisionId !== activeRevision.id ||
      response.analysis.transcriptDigest !== activeRevision.normalizedDigest
    ) {
      throw new DomainInvariantError("response-analysis-transcript");
    }
  }

  if (response.recording?.savedByUserAt.trim().length === 0) {
    throw new DomainInvariantError("response-recording-save-choice");
  }

  return response;
}

export function validateResponseBelongsToSession(
  session: InterviewSession,
  response: QuestionResponse,
): void {
  if (response.sessionId !== session.id) {
    throw new DomainInvariantError("response-session");
  }
  if (
    !session.questions.some((question) => question.id === response.question.id)
  ) {
    throw new DomainInvariantError("response-question");
  }
}

export function validateSelectedAttempts(
  session: InterviewSession,
  responses: readonly QuestionResponse[],
): void {
  const responseById = new Map<QuestionResponseId, QuestionResponse>(
    responses.map((response) => [response.id, response]),
  );

  for (const [questionId, responseId] of Object.entries(
    session.selectedAttemptByQuestion,
  ) as [InterviewQuestionId, QuestionResponseId][]) {
    const response = responseById.get(responseId);
    if (
      response?.sessionId !== session.id ||
      response.question.id !== questionId
    ) {
      throw new DomainInvariantError("session-selected-attempt");
    }
  }
}

export function validateFairnessComparison(
  comparison: FairnessComparison,
): FairnessComparison {
  if (comparison.approvedInvariantMessage) {
    if (
      !comparison.content.allContentInvariant ||
      !["exact", "substantially-unchanged"].includes(
        comparison.content.invariantBand ?? "",
      ) ||
      comparison.approvedInvariantMessage !== APPROVED_INVARIANT_MESSAGE
    ) {
      throw new DomainInvariantError("comparison-invariant-message");
    }
  }
  return comparison;
}
