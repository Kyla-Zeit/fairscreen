import type { InterviewMachineState } from "./machine";

export interface LivePrompt {
  readonly id: string;
  readonly text: string;
  readonly kind: "delivery" | "structure";
}

export interface LiveCaptureState {
  readonly status:
    | "idle"
    | "not-requested"
    | "starting"
    | "active"
    | "stopped"
    | "unavailable";
  readonly message: string;
}

export function selectLivePrompt({
  answerText,
  audioUi,
  cameraUi,
  elapsedMs,
  machine,
}: {
  readonly answerText: string;
  readonly audioUi: LiveCaptureState;
  readonly cameraUi: LiveCaptureState;
  readonly elapsedMs: number;
  readonly machine: InterviewMachineState;
}): LivePrompt | null {
  if (
    machine.state !== "answering" ||
    machine.settings.liveCoaching === "off"
  ) {
    return null;
  }

  const deliveryEnabled = ["delivery-timing", "both"].includes(
    machine.settings.liveCoaching,
  );
  const structureEnabled = ["answer-structure", "both"].includes(
    machine.settings.liveCoaching,
  );
  const words = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;
  const remainingMs =
    machine.activeDeadlineMs === undefined
      ? undefined
      : machine.activeDeadlineMs - (machine.activeStartedAtMs ?? 0) - elapsedMs;

  if (deliveryEnabled && remainingMs !== undefined && remainingMs <= 20_000) {
    return {
      id: "delivery-wrap",
      kind: "delivery",
      text: "Begin wrapping up with the result or main conclusion.",
    };
  }
  if (
    deliveryEnabled &&
    elapsedMs >= 8_000 &&
    audioUi.status === "unavailable"
  ) {
    return {
      id: "delivery-microphone",
      kind: "delivery",
      text: "Microphone timing is unavailable. Continue your answer; you can review the transcript manually.",
    };
  }
  if (
    deliveryEnabled &&
    machine.settings.cameraRequested &&
    elapsedMs >= 8_000 &&
    cameraUi.status === "unavailable"
  ) {
    return {
      id: "delivery-camera",
      kind: "delivery",
      text: "Camera conditions are unavailable. Continue speaking; this does not affect content coaching.",
    };
  }
  if (structureEnabled && elapsedMs >= 20_000 && words < 20) {
    return {
      id: "structure-example",
      kind: "structure",
      text: "Add a specific example rather than staying at a general level.",
    };
  }
  if (
    structureEnabled &&
    elapsedMs >= 40_000 &&
    !/\bI\s+(?:built|created|designed|implemented|led|resolved|tested|changed|investigated|improved|delivered)\b/i.test(
      answerText,
    )
  ) {
    return {
      id: "structure-action",
      kind: "structure",
      text: "Explain the action you personally took.",
    };
  }
  if (
    structureEnabled &&
    elapsedMs >= 65_000 &&
    !/\b(?:result|outcome|impact|improved|reduced|increased|resolved|delivered|learned)\b/i.test(
      answerText,
    )
  ) {
    return {
      id: "structure-result",
      kind: "structure",
      text: "Describe the result, impact, or lesson.",
    };
  }
  if (structureEnabled && elapsedMs >= 90_000) {
    return {
      id: "structure-role",
      kind: "structure",
      text: "Connect the example back to the role.",
    };
  }
  if (deliveryEnabled && elapsedMs >= 105_000) {
    return {
      id: "delivery-long",
      kind: "delivery",
      text: "Consider finishing your first response and leaving detail for a follow-up.",
    };
  }
  return null;
}

export function shouldPresentLivePrompt({
  candidate,
  currentPromptId,
  dismissedPromptIds,
  lastShownAtMs,
  nowMs,
  cooldownMs = 20_000,
}: {
  readonly candidate: LivePrompt | null;
  readonly currentPromptId?: string;
  readonly dismissedPromptIds: readonly string[];
  readonly lastShownAtMs: number;
  readonly nowMs: number;
  readonly cooldownMs?: number;
}): boolean {
  return Boolean(
    candidate &&
    currentPromptId !== candidate.id &&
    !dismissedPromptIds.includes(candidate.id) &&
    nowMs - lastShownAtMs >= cooldownMs,
  );
}
