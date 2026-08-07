import type {
  FairnessComparisonId,
  FairnessTrialId,
  InterviewSessionId,
  QuestionResponseId,
} from "../../../domain/common";
import type {
  FairnessComparison,
  FairnessTrial,
  InterviewSession,
  QuestionResponse,
  UserSettings,
} from "../../../domain/models";
import type {
  DeletionSummary,
  DeleteScope,
  FairScreenRepository,
  PageRequest,
  PageResult,
  QuarantinedRecord,
  SessionSearchQuery,
  StorageOpenState,
  StorageResult,
} from "../../../domain/ports";
import { EphemeralFairScreenRepository } from "../ephemeral/EphemeralFairScreenRepository";
import { DATABASE_SCHEMA_VERSION } from "../db/schema";
import { normalizeStorageFailure, storageSuccess } from "../db/idb";

const STORAGE_KEY = "fairscreen:persistent-core:v1";

interface PersistedCoreSnapshot {
  readonly schemaVersion: 1;
  readonly sessions: readonly InterviewSession[];
  readonly responses: readonly QuestionResponse[];
  readonly settings?: UserSettings;
}

/**
 * A small persistent mirror for the core text records. It intentionally does
 * not store recording blobs. IndexedDB remains the primary store; this mirror
 * keeps sessions and reviewed answers available if IndexedDB is blocked,
 * partially migrated, or fails a transaction in a particular browser profile.
 */
export class LocalStorageFairScreenRepository implements FairScreenRepository {
  readonly #delegate = new EphemeralFairScreenRepository();
  readonly #providedStorage: Storage | null | undefined;
  #storage: Storage | undefined;
  #opened = false;

  constructor(storage?: Storage | null) {
    this.#providedStorage = storage;
  }

  async open(): Promise<StorageResult<StorageOpenState>> {
    try {
      this.#storage = this.#resolveStorage();
      if (!this.#storage) {
        return {
          ok: false,
          error: {
            code: "unavailable",
            operation: "local-storage-open",
            recoverable: true,
            actions: ["retry", "use-ephemeral-session", "export"],
          },
        };
      }

      const opened = await this.#delegate.open();
      if (!opened.ok) return opened;
      await this.#hydrate();
      this.#opened = true;
      return storageSuccess({
        mode: "persistent",
        databaseVersion: DATABASE_SCHEMA_VERSION,
        supportedVersion: DATABASE_SCHEMA_VERSION,
      });
    } catch (error) {
      return {
        ok: false,
        error: normalizeStorageFailure("local-storage-open", error),
      };
    }
  }

  close(): void {
    this.#delegate.close();
    this.#opened = false;
  }

  getSession(id: InterviewSessionId) {
    return this.#delegate.getSession(id);
  }

  listSessions(query: SessionSearchQuery, page: PageRequest) {
    return this.#delegate.listSessions(query, page);
  }

  async saveSession(session: InterviewSession): Promise<StorageResult<void>> {
    return this.#writeThrough(
      () => this.#delegate.saveSession(session),
      "local-storage-save-session",
    );
  }

  getResponse(id: QuestionResponseId) {
    return this.#delegate.getResponse(id);
  }

  listResponses(sessionId: InterviewSessionId) {
    return this.#delegate.listResponses(sessionId);
  }

  async saveResponse(response: QuestionResponse): Promise<StorageResult<void>> {
    return this.#writeThrough(
      () => this.#delegate.saveResponse(response),
      "local-storage-save-response",
    );
  }

  getFairnessTrial(id: FairnessTrialId) {
    return this.#delegate.getFairnessTrial(id);
  }

  getFairnessComparison(id: FairnessComparisonId) {
    return this.#delegate.getFairnessComparison(id);
  }

  saveFairnessComparison(
    comparison: FairnessComparison,
    trials: readonly FairnessTrial[],
  ) {
    return this.#delegate.saveFairnessComparison(comparison, trials);
  }

  getSettings() {
    return this.#delegate.getSettings();
  }

  async saveSettings(settings: UserSettings): Promise<StorageResult<void>> {
    return this.#writeThrough(
      () => this.#delegate.saveSettings(settings),
      "local-storage-save-settings",
    );
  }

  async resetSettings(): Promise<StorageResult<UserSettings>> {
    const result = await this.#delegate.resetSettings();
    if (!result.ok) return result;
    const persisted = await this.#persist("local-storage-reset-settings");
    return persisted.ok ? result : persisted;
  }

  async delete(scope: DeleteScope): Promise<StorageResult<DeletionSummary>> {
    const result = await this.#delegate.delete(scope);
    if (!result.ok) return result;
    const persisted = await this.#persist(`local-storage-delete-${scope.kind}`);
    return persisted.ok ? result : persisted;
  }

  listQuarantinedRecords(): Promise<
    StorageResult<readonly QuarantinedRecord[]>
  > {
    return this.#delegate.listQuarantinedRecords();
  }

  async #writeThrough(
    write: () => Promise<StorageResult<void>>,
    operation: string,
  ): Promise<StorageResult<void>> {
    if (!this.#opened) {
      return {
        ok: false,
        error: {
          code: "not-open",
          operation,
          recoverable: true,
          actions: ["retry", "use-ephemeral-session"],
        },
      };
    }
    const result = await write();
    if (!result.ok) return result;
    return this.#persist(operation);
  }

  async #hydrate(): Promise<void> {
    const raw = this.#storage?.getItem(STORAGE_KEY);
    if (!raw) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.#storage?.removeItem(STORAGE_KEY);
      return;
    }

    if (!isPersistedCoreSnapshot(parsed)) {
      this.#storage?.removeItem(STORAGE_KEY);
      return;
    }

    for (const response of parsed.responses) {
      await this.#delegate.saveResponse(response);
    }
    for (const session of parsed.sessions) {
      await this.#delegate.saveSession(session);
    }
    if (parsed.settings) {
      await this.#delegate.saveSettings(parsed.settings);
    }
  }

  async #persist(operation: string): Promise<StorageResult<void>> {
    try {
      const sessionsResult = await this.#delegate.listSessions(
        { sort: "updated-desc" },
        { pageSize: 100_000 },
      );
      if (!sessionsResult.ok) return sessionsResult;

      const responses: QuestionResponse[] = [];
      for (const session of sessionsResult.value.values) {
        const responseResult = await this.#delegate.listResponses(session.id);
        if (!responseResult.ok) return responseResult;
        responses.push(...responseResult.value);
      }

      const settingsResult = await this.#delegate.getSettings();
      if (!settingsResult.ok) return settingsResult;

      const snapshot: PersistedCoreSnapshot = {
        schemaVersion: 1,
        sessions: sessionsResult.value.values,
        responses,
        settings: settingsResult.value,
      };
      this.#storage?.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      return storageSuccess(undefined);
    } catch (error) {
      return { ok: false, error: normalizeStorageFailure(operation, error) };
    }
  }

  #resolveStorage(): Storage | undefined {
    if (this.#providedStorage !== undefined) {
      return this.#providedStorage ?? undefined;
    }
    if (typeof window === "undefined") return undefined;
    return window.localStorage;
  }
}

function isPersistedCoreSnapshot(
  value: unknown,
): value is PersistedCoreSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersistedCoreSnapshot>;
  return (
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.sessions) &&
    Array.isArray(candidate.responses) &&
    (candidate.settings === undefined ||
      (candidate.settings !== null && typeof candidate.settings === "object"))
  );
}
