import type { IsoDateTime } from "../../domain/common";
import type { InterviewAnnouncement, InterviewMachineState } from "./machine";

export interface TimerSnapshot {
  readonly visible: boolean;
  readonly elapsedMs: number;
  readonly remainingMs?: number | undefined;
  readonly overtimeMs: number;
  readonly expired: boolean;
  readonly label: string;
  readonly modeLabel: string;
}

export function createTimerSnapshot(
  state: InterviewMachineState,
  nowMs: number,
): TimerSnapshot {
  if (
    state.settings.timingMode === "untimed" ||
    !["preparing", "answering"].includes(state.state) ||
    state.activeStartedAtMs === undefined
  ) {
    return {
      visible: false,
      elapsedMs: 0,
      overtimeMs: 0,
      expired: false,
      label: "Untimed",
      modeLabel: "Untimed",
    };
  }

  const elapsedMs = Math.max(0, nowMs - state.activeStartedAtMs);
  const remainingMs =
    state.activeDeadlineMs === undefined
      ? undefined
      : Math.max(0, state.activeDeadlineMs - nowMs);
  const overtimeMs =
    state.activeDeadlineMs === undefined
      ? 0
      : Math.max(0, nowMs - state.activeDeadlineMs);
  const expired = overtimeMs > 0 || remainingMs === 0;

  return {
    visible: true,
    elapsedMs,
    remainingMs,
    overtimeMs,
    expired,
    label:
      state.settings.timingMode === "strictPractice"
        ? formatDuration(remainingMs ?? 0)
        : expired && state.state === "answering"
          ? `+${formatDuration(overtimeMs)}`
          : formatDuration(remainingMs ?? 0),
    modeLabel:
      state.settings.timingMode === "strictPractice"
        ? "Strict practice"
        : "Flexible target",
  };
}

export function timerAnnouncementsBetween(
  state: InterviewMachineState,
  previousNowMs: number,
  nextNowMs: number,
  occurredAt: IsoDateTime,
): readonly InterviewAnnouncement[] {
  if (
    !state.timerAnnouncementsEnabled ||
    state.settings.timingMode === "untimed" ||
    state.activeDeadlineMs === undefined ||
    !["preparing", "answering"].includes(state.state)
  ) {
    return [];
  }

  const previousRemaining = state.activeDeadlineMs - previousNowMs;
  const nextRemaining = state.activeDeadlineMs - nextNowMs;
  const announcements: InterviewAnnouncement[] = [];

  if (crossed(previousRemaining, nextRemaining, 30_000)) {
    announcements.push({
      code: "TIMER_30_SECONDS",
      message: "30 seconds remaining.",
      occurredAt,
    });
  }

  if (crossed(previousRemaining, nextRemaining, 10_000)) {
    announcements.push({
      code: "TIMER_10_SECONDS",
      message:
        state.settings.timingMode === "strictPractice"
          ? "10 seconds remaining. Add time if you need it."
          : "10 seconds remaining.",
      occurredAt,
    });
  }

  if (crossed(previousRemaining, nextRemaining, 0)) {
    announcements.push({
      code: "TIMER_EXPIRED",
      message:
        state.settings.timingMode === "strictPractice"
          ? "Time expired."
          : "Target time reached. Finish when you are ready.",
      occurredAt,
    });
  }

  if (
    state.settings.timingMode === "flexible" &&
    previousNowMs <= state.activeDeadlineMs &&
    nextNowMs > state.activeDeadlineMs
  ) {
    announcements.push({
      code: "TIMER_OVERTIME",
      message: "Overtime has started.",
      occurredAt,
    });
  }

  return announcements;
}

export function formatDuration(millisecondsValue: number): string {
  const totalSeconds = Math.max(0, Math.ceil(millisecondsValue / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function crossed(
  previousRemainingMs: number,
  nextRemainingMs: number,
  thresholdMs: number,
): boolean {
  return previousRemainingMs > thresholdMs && nextRemainingMs <= thresholdMs;
}
