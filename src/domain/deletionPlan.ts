import type {
  FairnessComparisonId,
  FairnessTrialId,
  InterviewSessionId,
  IsoDateTime,
  QuestionResponseId,
  RecordingId,
} from "./common";
import type {
  FairnessComparison,
  FairnessTrial,
  InterviewSession,
  QuestionResponse,
} from "./models";
import type { DeletionSummary, DeleteScope } from "./ports";

export interface RecordingOwner {
  readonly id: RecordingId;
  readonly responseId: QuestionResponseId;
}

export interface DeletionState {
  readonly sessions: readonly InterviewSession[];
  readonly responses: readonly QuestionResponse[];
  readonly recordings: readonly RecordingOwner[];
  readonly fairnessTrials: readonly FairnessTrial[];
  readonly fairnessComparisons: readonly FairnessComparison[];
  readonly settingsPresent: boolean;
}

export interface DeletionPlan {
  readonly deleteSessionIds: ReadonlySet<InterviewSessionId>;
  readonly deleteResponseIds: ReadonlySet<QuestionResponseId>;
  readonly deleteRecordingIds: ReadonlySet<RecordingId>;
  readonly deleteTrialIds: ReadonlySet<FairnessTrialId>;
  readonly deleteComparisonIds: ReadonlySet<FairnessComparisonId>;
  readonly updatedSessions: readonly InterviewSession[];
  readonly updatedResponses: readonly QuestionResponse[];
  readonly updatedComparisons: readonly FairnessComparison[];
  readonly summary: DeletionSummary;
}

export function buildDeletionPlan(
  scope: DeleteScope,
  state: DeletionState,
  updatedAt: IsoDateTime,
): DeletionPlan {
  const sessions = new Set<InterviewSessionId>();
  const responses = new Set<QuestionResponseId>();
  const recordings = new Set<RecordingId>();
  const trials = new Set<FairnessTrialId>();
  const comparisons = new Set<FairnessComparisonId>();
  const updatedSessions = new Map<InterviewSessionId, InterviewSession>();
  const updatedResponses = new Map<QuestionResponseId, QuestionResponse>();
  const updatedComparisons = new Map<
    FairnessComparisonId,
    FairnessComparison
  >();

  const removeTrial = (trialId: FairnessTrialId) => {
    const trial = state.fairnessTrials.find((item) => item.id === trialId);
    if (!trial || trials.has(trialId)) {
      return;
    }
    trials.add(trialId);
    if (comparisons.has(trial.comparisonId)) {
      return;
    }
    const comparison =
      updatedComparisons.get(trial.comparisonId) ??
      state.fairnessComparisons.find((item) => item.id === trial.comparisonId);
    if (comparison) {
      updatedComparisons.set(
        comparison.id,
        removeTrialFromComparison(comparison, trialId, updatedAt),
      );
    }
  };

  const removeResponse = (responseId: QuestionResponseId) => {
    const response = state.responses.find((item) => item.id === responseId);
    if (!response || responses.has(responseId)) {
      return;
    }
    responses.add(responseId);
    if (response.recording) {
      recordings.add(response.recording.id);
    }
    const session =
      updatedSessions.get(response.sessionId) ??
      state.sessions.find((item) => item.id === response.sessionId);
    if (session && !sessions.has(session.id)) {
      updatedSessions.set(
        session.id,
        removeResponseFromSession(session, responseId, updatedAt),
      );
    }
    for (const trial of state.fairnessTrials) {
      if (trial.responseId === responseId) {
        removeTrial(trial.id);
      }
    }
  };

  const removeSession = (sessionId: InterviewSessionId) => {
    if (!state.sessions.some((session) => session.id === sessionId)) {
      return;
    }
    sessions.add(sessionId);
    updatedSessions.delete(sessionId);
    for (const response of state.responses) {
      if (response.sessionId === sessionId) {
        removeResponse(response.id);
      }
    }
  };

  const removeComparison = (comparisonId: FairnessComparisonId) => {
    if (
      !state.fairnessComparisons.some(
        (comparison) => comparison.id === comparisonId,
      )
    ) {
      return;
    }
    comparisons.add(comparisonId);
    updatedComparisons.delete(comparisonId);
    for (const trial of state.fairnessTrials) {
      if (trial.comparisonId === comparisonId) {
        trials.add(trial.id);
      }
    }
  };

  switch (scope.kind) {
    case "recording": {
      const owner = state.recordings.find(
        (recording) => recording.id === scope.id,
      );
      if (owner) {
        recordings.add(owner.id);
        const response = state.responses.find(
          (item) => item.id === owner.responseId,
        );
        if (response?.recording?.id === owner.id) {
          updatedResponses.set(
            response.id,
            removeRecordingFromResponse(response, updatedAt),
          );
        }
      }
      break;
    }
    case "response":
      removeResponse(scope.id);
      break;
    case "fairness-trial":
      removeTrial(scope.id);
      break;
    case "fairness-comparison":
      removeComparison(scope.id);
      break;
    case "session":
      removeSession(scope.id);
      break;
    case "demo-data":
      for (const session of state.sessions) {
        if (session.isDemo) {
          removeSession(session.id);
        }
      }
      for (const comparison of state.fairnessComparisons) {
        if (comparison.isDemo) {
          removeComparison(comparison.id);
        }
      }
      for (const trial of state.fairnessTrials) {
        if (trial.isDemo) {
          trials.add(trial.id);
        }
      }
      break;
    case "all-data":
      for (const session of state.sessions) {
        sessions.add(session.id);
      }
      for (const response of state.responses) {
        responses.add(response.id);
      }
      for (const recording of state.recordings) {
        recordings.add(recording.id);
      }
      for (const trial of state.fairnessTrials) {
        trials.add(trial.id);
      }
      for (const comparison of state.fairnessComparisons) {
        comparisons.add(comparison.id);
      }
      updatedSessions.clear();
      updatedResponses.clear();
      updatedComparisons.clear();
      break;
  }

  return {
    deleteSessionIds: sessions,
    deleteResponseIds: responses,
    deleteRecordingIds: recordings,
    deleteTrialIds: trials,
    deleteComparisonIds: comparisons,
    updatedSessions: [...updatedSessions.values()].filter(
      (session) => !sessions.has(session.id),
    ),
    updatedResponses: [...updatedResponses.values()].filter(
      (response) => !responses.has(response.id),
    ),
    updatedComparisons: [...updatedComparisons.values()].filter(
      (comparison) => !comparisons.has(comparison.id),
    ),
    summary: {
      scope: scope.kind,
      sessions: sessions.size,
      responses: responses.size,
      recordings: recordings.size,
      fairnessTrials: trials.size,
      fairnessComparisons: comparisons.size,
      settings:
        scope.kind === "all-data" &&
        scope.includeSettings &&
        state.settingsPresent
          ? 1
          : 0,
    },
  };
}

function removeRecordingFromResponse(
  response: QuestionResponse,
  updatedAt: IsoDateTime,
): QuestionResponse {
  const { recording, ...withoutRecording } = response;
  void recording;
  return { ...withoutRecording, updatedAt };
}

function removeResponseFromSession(
  session: InterviewSession,
  responseId: QuestionResponseId,
  updatedAt: IsoDateTime,
): InterviewSession {
  const selectedEntries = Object.entries(
    session.selectedAttemptByQuestion,
  ).filter(([, selectedId]) => selectedId !== responseId);

  return {
    ...session,
    responseIds: session.responseIds.filter((id) => id !== responseId),
    selectedAttemptByQuestion: Object.fromEntries(selectedEntries),
    updatedAt,
  };
}

function removeTrialFromComparison(
  comparison: FairnessComparison,
  trialId: FairnessTrialId,
  updatedAt: IsoDateTime,
): FairnessComparison {
  const revisionEntries = Object.entries(
    comparison.sourceTranscriptRevisions,
  ).filter(([sourceTrialId]) => sourceTrialId !== trialId);

  const { approvedInvariantMessage, ...withoutInvariantMessage } = comparison;
  void approvedInvariantMessage;
  return {
    ...withoutInvariantMessage,
    status: "incomplete",
    trialIds: comparison.trialIds.filter((id) => id !== trialId),
    sourceTranscriptRevisions: Object.fromEntries(revisionEntries),
    updatedAt,
  };
}
