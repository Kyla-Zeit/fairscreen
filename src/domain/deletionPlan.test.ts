import { describe, expect, it } from "vitest";

import {
  fairnessComparisonId,
  fairnessGroupId,
  fairnessTrialId,
  isoDateTime,
} from "./factories";
import { buildDeletionPlan } from "./deletionPlan";
import type { FairnessComparison, FairnessTrial } from "./models";
import { DEMO_COMPARISON, DEMO_TRIALS } from "../features/demo/seed";
import {
  createResponseFixture,
  createSessionFixture,
} from "../infrastructure/storage/testing/domainFixtures";

const updatedAt = isoDateTime("2026-02-01T00:00:00.000Z");

function cascadeFixture() {
  const initialSession = createSessionFixture();
  const response = createResponseFixture(initialSession.id, "one", true);
  const session = {
    ...initialSession,
    responseIds: [response.id],
    selectedAttemptByQuestion: {
      [response.question.id]: response.id,
    },
  };
  const comparisonId = fairnessComparisonId("comparison:user");
  const groupId = fairnessGroupId("group:user");
  const sourceTrial = DEMO_TRIALS[0];
  if (!sourceTrial) {
    throw new Error("Demo trial fixture is unavailable.");
  }
  const linkedTrial: FairnessTrial = {
    ...sourceTrial,
    id: fairnessTrialId("trial:linked"),
    comparisonId,
    groupId,
    responseId: response.id,
    source: "reused-response",
    condition: { ...sourceTrial.condition, source: "user-described" },
    isDemo: false,
  };
  const remainingTrial: FairnessTrial = {
    ...sourceTrial,
    id: fairnessTrialId("trial:remaining"),
    comparisonId,
    groupId,
    source: "manual",
    condition: { ...sourceTrial.condition, source: "user-described" },
    isDemo: false,
  };
  const comparison: FairnessComparison = {
    ...DEMO_COMPARISON,
    id: comparisonId,
    groupId,
    trialIds: [linkedTrial.id, remainingTrial.id],
    sourceTranscriptRevisions: {
      [linkedTrial.id]: linkedTrial.content.transcriptRevisionId,
      [remainingTrial.id]: remainingTrial.content.transcriptRevisionId,
    },
    isDemo: false,
  };
  return {
    session,
    response,
    linkedTrial,
    remainingTrial,
    comparison,
    state: {
      sessions: [session],
      responses: [response],
      recordings: response.recording
        ? [{ id: response.recording.id, responseId: response.id }]
        : [],
      fairnessTrials: [linkedTrial, remainingTrial],
      fairnessComparisons: [comparison],
      settingsPresent: true,
    },
  };
}

describe("scoped deletion plans", () => {
  it("removes a recording only and clears its response reference", () => {
    const fixture = cascadeFixture();
    const recording = fixture.response.recording;
    if (!recording) throw new Error("Recording fixture is unavailable.");

    const plan = buildDeletionPlan(
      { kind: "recording", id: recording.id },
      fixture.state,
      updatedAt,
    );
    expect([...plan.deleteRecordingIds]).toEqual([recording.id]);
    expect(plan.deleteResponseIds.size).toBe(0);
    expect(plan.updatedResponses[0]).not.toHaveProperty("recording");
  });

  it("deletes a response's recording and derived trial while preserving its comparison", () => {
    const fixture = cascadeFixture();
    const plan = buildDeletionPlan(
      { kind: "response", id: fixture.response.id },
      fixture.state,
      updatedAt,
    );

    expect([...plan.deleteResponseIds]).toEqual([fixture.response.id]);
    expect([...plan.deleteRecordingIds]).toEqual([
      fixture.response.recording?.id,
    ]);
    expect([...plan.deleteTrialIds]).toEqual([fixture.linkedTrial.id]);
    expect(plan.deleteComparisonIds.size).toBe(0);
    expect(plan.updatedSessions[0]?.responseIds).toEqual([]);
    expect(plan.updatedComparisons[0]).toMatchObject({
      status: "incomplete",
      trialIds: [fixture.remainingTrial.id],
    });
    expect(plan.updatedComparisons[0]).not.toHaveProperty(
      "approvedInvariantMessage",
    );
  });

  it("deletes a comparison and exactly its owned trials", () => {
    const fixture = cascadeFixture();
    const plan = buildDeletionPlan(
      { kind: "fairness-comparison", id: fixture.comparison.id },
      fixture.state,
      updatedAt,
    );
    expect([...plan.deleteComparisonIds]).toEqual([fixture.comparison.id]);
    expect(new Set(plan.deleteTrialIds)).toEqual(
      new Set([fixture.linkedTrial.id, fixture.remainingTrial.id]),
    );
    expect(plan.deleteSessionIds.size).toBe(0);
  });

  it("keeps settings outside all-data scope unless explicitly included", () => {
    const fixture = cascadeFixture();
    const withoutSettings = buildDeletionPlan(
      { kind: "all-data", includeSettings: false },
      fixture.state,
      updatedAt,
    );
    const withSettings = buildDeletionPlan(
      { kind: "all-data", includeSettings: true },
      fixture.state,
      updatedAt,
    );
    expect(withoutSettings.summary.settings).toBe(0);
    expect(withSettings.summary.settings).toBe(1);
  });
});
