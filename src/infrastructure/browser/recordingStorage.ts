import type { RecordingId } from "../../domain/common";
import type { RecordingReference } from "../../domain/models";
import type { StorageResult } from "../../domain/ports";
import { applyDatabaseMigrations } from "../storage/migrations";
import { DATABASE_NAME, DATABASE_SCHEMA_VERSION } from "../storage/db/schema";
import { storageFailure } from "../storage/db/idb";
import {
  IndexedDbRecordingRepository,
  type SavedRecordingInput,
} from "../storage/repositories/IndexedDbRecordingRepository";

export interface BrowserRecordingStorageEnvironment {
  readonly indexedDB?: IDBFactory | undefined;
  readonly databaseName?: string;
}

export async function saveBrowserRecordingAfterUserChoice(
  input: SavedRecordingInput,
  environment: BrowserRecordingStorageEnvironment = readRecordingStorageEnvironment(),
): Promise<StorageResult<RecordingReference>> {
  const factory = environment.indexedDB;
  if (!factory) {
    return {
      ok: false,
      error: {
        code: "unavailable",
        operation: "save-recording",
        recoverable: true,
        actions: ["continue-without-recording", "export"],
      },
    };
  }

  const opened = await openRecordingDatabase({
    ...environment,
    indexedDB: factory,
  });
  if (!opened.ok) {
    return opened;
  }

  try {
    return await new IndexedDbRecordingRepository(
      opened.value,
    ).saveAfterUserChoice(input);
  } finally {
    opened.value.close();
  }
}

export async function getBrowserRecording(
  id: RecordingId,
  environment: BrowserRecordingStorageEnvironment = readRecordingStorageEnvironment(),
) {
  const factory = environment.indexedDB;
  if (!factory) {
    return {
      ok: false as const,
      error: {
        code: "unavailable" as const,
        operation: "get-recording",
        recoverable: true,
        actions: ["export", "continue-without-recording"] as const,
      },
    };
  }

  const opened = await openRecordingDatabase({
    ...environment,
    indexedDB: factory,
  });
  if (!opened.ok) return opened;

  try {
    return await new IndexedDbRecordingRepository(opened.value).get(id);
  } finally {
    opened.value.close();
  }
}

function openRecordingDatabase(
  environment: BrowserRecordingStorageEnvironment & {
    readonly indexedDB: IDBFactory;
  },
): Promise<StorageResult<IDBDatabase>> {
  return new Promise((resolve) => {
    try {
      const request = environment.indexedDB.open(
        environment.databaseName ?? DATABASE_NAME,
        DATABASE_SCHEMA_VERSION,
      );

      request.onupgradeneeded = (event) => {
        const transaction = request.transaction;
        if (!transaction) {
          request.result.close();
          resolve({
            ok: false,
            error: {
              code: "transaction-aborted",
              operation: "open-recording-db",
              recoverable: true,
              actions: ["retry", "use-ephemeral-session"],
            },
          });
          return;
        }
        applyDatabaseMigrations(
          request.result,
          transaction,
          event.oldVersion,
          event.newVersion ?? DATABASE_SCHEMA_VERSION,
        );
      };
      request.onblocked = () => {
        resolve({
          ok: false,
          error: {
            code: "blocked",
            operation: "open-recording-db",
            recoverable: true,
            actions: ["retry", "use-ephemeral-session"],
          },
        });
      };
      request.onerror = () => {
        resolve(
          storageFailure(
            "open-recording-db",
            request.error ??
              new DOMException(
                "Recording database open failed",
                "UnknownError",
              ),
          ),
        );
      };
      request.onsuccess = () => {
        resolve({ ok: true, value: request.result });
      };
    } catch (error) {
      resolve(storageFailure("open-recording-db", error));
    }
  });
}

function readRecordingStorageEnvironment(): Required<BrowserRecordingStorageEnvironment> {
  return {
    indexedDB: typeof indexedDB === "undefined" ? undefined : indexedDB,
    databaseName: DATABASE_NAME,
  };
}
