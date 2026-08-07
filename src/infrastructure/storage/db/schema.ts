export const DATABASE_NAME = "fairscreen";
export const DATABASE_SCHEMA_VERSION = 2;

export const STORE_NAMES = {
  meta: "meta",
  sessions: "sessions",
  responses: "responses",
  recordings: "recordings",
  fairnessTrials: "fairnessTrials",
  fairnessComparisons: "fairnessComparisons",
  settings: "settings",
} as const;

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES];

export const ALL_STORE_NAMES: readonly StoreName[] = Object.values(STORE_NAMES);
