import { STORE_NAMES } from "../db/schema";
import type { DatabaseMigration } from "./types";

export const migrationV1: DatabaseMigration = {
  version: 1,
  apply(database, transaction) {
    ensureStore(database, transaction, STORE_NAMES.meta, "key");

    const sessions = ensureStore(
      database,
      transaction,
      STORE_NAMES.sessions,
      "id",
    );
    ensureIndex(sessions, "byUpdatedAt", "updatedAt");
    ensureIndex(sessions, "byCreatedAt", "createdAt");
    ensureIndex(sessions, "byStatus", "status");
    ensureIndex(sessions, "byCategory", "category");
    ensureIndex(sessions, "byJobTitleNormalized", "jobTitleNormalized");

    const responses = ensureStore(
      database,
      transaction,
      STORE_NAMES.responses,
      "id",
    );
    ensureIndex(responses, "bySessionId", "sessionId");
    ensureIndex(responses, "bySessionAndQuestion", [
      "sessionId",
      "question.id",
    ]);
    ensureIndex(responses, "byUpdatedAt", "updatedAt");

    const recordings = ensureStore(
      database,
      transaction,
      STORE_NAMES.recordings,
      "id",
    );
    ensureIndex(recordings, "byResponseId", "responseId", true);
    ensureIndex(recordings, "byCreatedAt", "createdAt");

    const trials = ensureStore(
      database,
      transaction,
      STORE_NAMES.fairnessTrials,
      "id",
    );
    ensureIndex(trials, "byComparisonId", "comparisonId");
    ensureIndex(trials, "byCreatedAt", "createdAt");
    ensureIndex(trials, "bySource", "source");

    const comparisons = ensureStore(
      database,
      transaction,
      STORE_NAMES.fairnessComparisons,
      "id",
    );
    ensureIndex(comparisons, "byUpdatedAt", "updatedAt");
    ensureIndex(comparisons, "byStatus", "status");

    ensureStore(database, transaction, STORE_NAMES.settings, "id");
  },
};

function ensureStore(
  database: IDBDatabase,
  transaction: IDBTransaction,
  name: string,
  keyPath: string,
): IDBObjectStore {
  return database.objectStoreNames.contains(name)
    ? transaction.objectStore(name)
    : database.createObjectStore(name, { keyPath });
}

function ensureIndex(
  store: IDBObjectStore,
  name: string,
  keyPath: string | readonly string[],
  unique = false,
): void {
  if (!store.indexNames.contains(name)) {
    store.createIndex(name, keyPath, { unique });
  }
}
