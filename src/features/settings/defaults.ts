import {
  isoDateTime,
  milliseconds,
  userSettingsId,
  validatedLocale,
} from "../../domain/factories";
import { snapshotInterviewSettings } from "../../domain/invariants";
import type { InterviewSettings, UserSettings } from "../../domain/models";
import type { Clock } from "../../domain/ports";

export const DEFAULT_INTERVIEW_SETTINGS: InterviewSettings = Object.freeze({
  questionCount: 5,
  preparationTimeMs: milliseconds(60_000),
  answerTimeMs: milliseconds(120_000),
  timingMode: "flexible",
  extensionTimeMs: milliseconds(30_000),
  liveCoaching: "off",
  transcription: "manual",
  cameraRequested: false,
  microphoneRequested: false,
  recordingCaptureRequested: false,
  screenReaderTimerAnnouncements: true,
});

export const DEFAULT_SETTINGS_TIMESTAMP = isoDateTime(
  "2026-01-01T00:00:00.000Z",
);

export function createDefaultUserSettings(
  clock?: Clock,
  locale = "en-CA",
): UserSettings {
  const timestamp = clock?.now() ?? DEFAULT_SETTINGS_TIMESTAMP;
  return Object.freeze({
    schemaVersion: 1,
    id: userSettingsId("user-settings"),
    createdAt: timestamp,
    updatedAt: timestamp,
    defaultInterviewSettings: snapshotInterviewSettings(
      DEFAULT_INTERVIEW_SETTINGS,
    ),
    textSize: "default",
    contrast: "system",
    motion: "system",
    hideSelfPreviewWhileAnswering: false,
    showConditionPrompts: false,
    announceTimerThresholds: true,
    preferredLocale: validatedLocale(locale),
    rememberSelectedDevices: false,
    persistentStorageRequested: false,
  });
}

export function snapshotSettingsForSession(
  settings: UserSettings,
): InterviewSettings {
  return snapshotInterviewSettings(settings.defaultInterviewSettings);
}
