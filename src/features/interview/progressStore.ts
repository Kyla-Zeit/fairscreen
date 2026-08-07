import type { InterviewSessionId } from "../../domain/common";
import type { InterviewProgressRecord } from "./progressPersistence";

export interface InterviewProgressStore {
  read(sessionId: InterviewSessionId): InterviewProgressRecord | null;
  write(progress: InterviewProgressRecord): void;
  clear(sessionId: InterviewSessionId): void;
}

const progressKeyPrefix = "fairscreen:m06:interview-progress:";

export function createMemoryInterviewProgressStore(): InterviewProgressStore {
  const records = new Map<string, InterviewProgressRecord>();

  return {
    read(sessionId) {
      return records.get(keyFor(sessionId)) ?? null;
    },
    write(progress) {
      records.set(keyFor(progress.sessionId), progress);
    },
    clear(sessionId) {
      records.delete(keyFor(sessionId));
    },
  };
}

export function createSessionStorageInterviewProgressStore(
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem"> | undefined,
): InterviewProgressStore {
  if (!storage) {
    return createMemoryInterviewProgressStore();
  }

  return {
    read(sessionId) {
      const raw = storage.getItem(keyFor(sessionId));
      if (!raw) {
        return null;
      }

      try {
        const parsed: unknown = JSON.parse(raw);
        return isInterviewProgressRecord(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    write(progress) {
      storage.setItem(keyFor(progress.sessionId), JSON.stringify(progress));
    },
    clear(sessionId) {
      storage.removeItem(keyFor(sessionId));
    },
  };
}

export function createBrowserInterviewProgressStore(): InterviewProgressStore {
  return createSessionStorageInterviewProgressStore(
    typeof window === "undefined" ? undefined : window.sessionStorage,
  );
}

function keyFor(sessionId: InterviewSessionId) {
  return `${progressKeyPrefix}${sessionId}`;
}

function isInterviewProgressRecord(
  input: unknown,
): input is InterviewProgressRecord {
  if (!input || typeof input !== "object") {
    return false;
  }

  const record = input as Partial<InterviewProgressRecord>;
  return (
    record.schemaVersion === 1 &&
    typeof record.sessionId === "string" &&
    ["ready", "betweenQuestions", "complete"].includes(String(record.state)) &&
    Array.isArray(record.questions) &&
    typeof record.settings === "object" &&
    typeof record.currentQuestionIndex === "number" &&
    typeof record.previewHidden === "boolean" &&
    typeof record.timerAnnouncementsEnabled === "boolean" &&
    typeof record.attemptsByQuestion === "object" &&
    typeof record.selectedAttemptByQuestion === "object" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}
