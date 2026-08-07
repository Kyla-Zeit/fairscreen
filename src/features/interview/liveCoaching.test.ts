import { describe, expect, it } from "vitest";

import { interviewSessionId } from "../../domain/factories";
import { DEFAULT_INTERVIEW_SETTINGS } from "../settings/defaults";
import { createInterviewMachineState } from "./machine";
import {
  selectLivePrompt,
  shouldPresentLivePrompt,
  type LiveCaptureState,
} from "./liveCoaching";

const active: LiveCaptureState = {
  status: "active",
  message: "Active",
};

function answeringMachine(
  liveCoaching: "off" | "delivery-timing" | "answer-structure" | "both",
) {
  return {
    ...createInterviewMachineState({
      sessionId: interviewSessionId("session:live-coaching-test"),
      settings: {
        ...DEFAULT_INTERVIEW_SETTINGS,
        liveCoaching,
      },
      questions: [],
    }),
    state: "answering" as const,
    activeStartedAtMs: 1_000,
    activeDeadlineMs: 121_000,
  };
}

describe("live coaching prompt selection", () => {
  it("produces no prompt when coaching is off", () => {
    expect(
      selectLivePrompt({
        machine: answeringMachine("off"),
        elapsedMs: 110_000,
        answerText: "",
        audioUi: active,
        cameraUi: active,
      }),
    ).toBeNull();
  });

  it("shows delivery prompts only in a delivery-enabled mode", () => {
    expect(
      selectLivePrompt({
        machine: answeringMachine("delivery-timing"),
        elapsedMs: 105_000,
        answerText: "A developed answer with a clear example and result.",
        audioUi: active,
        cameraUi: active,
      })?.id,
    ).toBe("delivery-wrap");

    expect(
      selectLivePrompt({
        machine: answeringMachine("answer-structure"),
        elapsedMs: 105_000,
        answerText: "I designed the solution and explained the result.",
        audioUi: active,
        cameraUi: active,
      })?.kind,
    ).toBe("structure");
  });

  it("shows a structure prompt for a thin answer", () => {
    expect(
      selectLivePrompt({
        machine: answeringMachine("answer-structure"),
        elapsedMs: 25_000,
        answerText: "I would solve it carefully.",
        audioUi: active,
        cameraUi: active,
      })?.id,
    ).toBe("structure-example");
  });

  it("respects dismissals and the cooldown", () => {
    const candidate = {
      id: "structure-example",
      kind: "structure" as const,
      text: "Add a specific example.",
    };

    expect(
      shouldPresentLivePrompt({
        candidate,
        dismissedPromptIds: [],
        lastShownAtMs: 1_000,
        nowMs: 20_999,
      }),
    ).toBe(false);
    expect(
      shouldPresentLivePrompt({
        candidate,
        dismissedPromptIds: [],
        lastShownAtMs: 1_000,
        nowMs: 21_000,
      }),
    ).toBe(true);
    expect(
      shouldPresentLivePrompt({
        candidate,
        dismissedPromptIds: [candidate.id],
        lastShownAtMs: Number.NEGATIVE_INFINITY,
        nowMs: 21_000,
      }),
    ).toBe(false);
  });
});
