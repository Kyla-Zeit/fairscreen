import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";

import {
  byteCount,
  interviewSessionId,
  milliseconds,
  recordingId,
} from "../../../domain/factories";
import type { StorageFailure } from "../../../domain/ports";
import { ALL_STORE_NAMES, STORE_NAMES } from "../db/schema";
import { requestResult, transactionDone } from "../db/idb";
import { applyDatabaseMigrations } from "../migrations";
import {
  createResponseFixture,
  createSessionFixture,
  FIXED_TIMESTAMP,
  FixedClock,
} from "../testing/domainFixtures";
import { IndexedDbFairScreenRepository } from "./IndexedDbFairScreenRepository";
import { IndexedDbRecordingRepository } from "./IndexedDbRecordingRepository";

function repositoryWith(
  factory: IDBFactory,
  name: string,
  failOperation?: (operation: string) => StorageFailure | undefined,
) {
  return new IndexedDbFairScreenRepository({
    factory,
    databaseName: name,
    clock: new FixedClock(),
    ...(failOperation ? { failOperation } : {}),
  });
}

describe("IndexedDB schema and migrations", () => {
  it("creates every version-1 store and required index", async () => {
    const factory = new IDBFactory();
    const name = "schema-test";
    const repository = repositoryWith(factory, name);
    expect((await repository.open()).ok).toBe(true);

    const database = await openDatabase(factory, name);
    expect(Array.from(database.objectStoreNames).sort()).toEqual(
      [...ALL_STORE_NAMES].sort(),
    );
    const transaction = database.transaction(
      [
        STORE_NAMES.sessions,
        STORE_NAMES.responses,
        STORE_NAMES.recordings,
        STORE_NAMES.fairnessTrials,
        STORE_NAMES.fairnessComparisons,
      ],
      "readonly",
    );
    expect(
      Array.from(
        transaction.objectStore(STORE_NAMES.sessions).indexNames,
      ).sort(),
    ).toEqual(
      [
        "byCategory",
        "byCreatedAt",
        "byJobTitleNormalized",
        "byStatus",
        "byUpdatedAt",
      ].sort(),
    );
    expect(
      Array.from(
        transaction.objectStore(STORE_NAMES.responses).indexNames,
      ).sort(),
    ).toEqual(["bySessionAndQuestion", "bySessionId", "byUpdatedAt"].sort());
    expect(
      transaction.objectStore(STORE_NAMES.recordings).index("byResponseId")
        .unique,
    ).toBe(true);
    await transactionDone(transaction);
    database.close();
    repository.close();
  });

  it("repairs an incomplete version-1 database during the version-2 upgrade", async () => {
    const factory = new IDBFactory();
    const name = "repair-old-schema";
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAMES.meta, { keyPath: "key" });
    };
    const oldDatabase = await requestResult(request);
    oldDatabase.close();

    const repository = repositoryWith(factory, name);
    expect(await repository.open()).toMatchObject({
      ok: true,
      value: { mode: "persistent", databaseVersion: 2 },
    });

    const repaired = await openDatabase(factory, name);
    expect(Array.from(repaired.objectStoreNames).sort()).toEqual(
      [...ALL_STORE_NAMES].sort(),
    );
    repaired.close();
    repository.close();
  });

  it("can apply the ordered migration twice during the same upgrade", async () => {
    const factory = new IDBFactory();
    const request = factory.open("idempotent-migration", 1);
    request.onupgradeneeded = (event) => {
      const transaction = request.transaction;
      if (!transaction) throw new Error("Upgrade transaction unavailable.");
      applyDatabaseMigrations(request.result, transaction, event.oldVersion, 1);
      applyDatabaseMigrations(request.result, transaction, event.oldVersion, 1);
    };
    const database = await requestResult(request);
    expect(Array.from(database.objectStoreNames).sort()).toEqual(
      [...ALL_STORE_NAMES].sort(),
    );
    database.close();
  });
});

describe("IndexedDB repository behavior", () => {
  it("round-trips records and composes bounded search filters", async () => {
    const factory = new IDBFactory();
    const repository = repositoryWith(factory, "round-trip");
    await repository.open();
    const session = createSessionFixture();
    const response = createResponseFixture(session.id);
    expect((await repository.saveSession(session)).ok).toBe(true);
    expect((await repository.saveResponse(response)).ok).toBe(true);

    await expect(repository.getSession(session.id)).resolves.toEqual({
      ok: true,
      value: session,
    });
    await expect(repository.getResponse(response.id)).resolves.toEqual({
      ok: true,
      value: response,
    });
    const list = await repository.listSessions(
      {
        text: "developer project",
        statuses: ["ready"],
        categories: ["software-technical"],
        sort: "job-title-asc",
      },
      { pageSize: 10 },
    );
    expect(list.ok && list.value.values).toEqual([session]);
    repository.close();
  });

  it("aborts an injected quota failure without reporting or storing success", async () => {
    const factory = new IDBFactory();
    let fail = true;
    const quota: StorageFailure = {
      code: "quota-exceeded",
      operation: "save-session:commit",
      recoverable: true,
      actions: ["export", "delete-selected-data"],
    };
    const repository = repositoryWith(factory, "quota", (operation) =>
      fail && operation === "save-session:commit" ? quota : undefined,
    );
    await repository.open();
    const session = createSessionFixture();
    await expect(repository.saveSession(session)).resolves.toEqual({
      ok: false,
      error: quota,
    });
    fail = false;
    await expect(repository.getSession(session.id)).resolves.toEqual({
      ok: true,
      value: null,
    });
    repository.close();
  });

  it("isolates a corrupt record without deleting the database", async () => {
    const factory = new IDBFactory();
    const name = "corrupt";
    const repository = repositoryWith(factory, name);
    await repository.open();
    const database = await openDatabase(factory, name);
    const transaction = database.transaction(STORE_NAMES.sessions, "readwrite");
    transaction.objectStore(STORE_NAMES.sessions).put({
      id: "session:corrupt",
      schemaVersion: 1,
      rawPixels: [1, 2, 3],
    });
    await transactionDone(transaction);

    const result = await repository.getSession(
      interviewSessionId("session:corrupt"),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "record-corrupt" },
    });
    const quarantine = await repository.listQuarantinedRecords();
    expect(quarantine).toMatchObject({
      ok: true,
      value: [
        {
          storeName: "sessions",
          key: "session:corrupt",
          schemaVersion: 1,
          reasonCode: "schema-invalid",
        },
      ],
    });
    const rawCheck = database.transaction(STORE_NAMES.sessions, "readonly");
    const rawRequest: IDBRequest<unknown> = rawCheck
      .objectStore(STORE_NAMES.sessions)
      .get("session:corrupt");
    const raw = await requestResult(rawRequest);
    await transactionDone(rawCheck);
    expect(raw).toBeDefined();
    database.close();
    repository.close();
  });

  it("opens newer databases in read-only recovery mode", async () => {
    const factory = new IDBFactory();
    const database = await openDatabase(factory, "future", 3);
    database.close();
    const repository = repositoryWith(factory, "future");
    await expect(repository.open()).resolves.toEqual({
      ok: true,
      value: {
        mode: "read-only-recovery",
        databaseVersion: 3,
        supportedVersion: 2,
      },
    });
    expect(await repository.saveSession(createSessionFixture())).toMatchObject({
      ok: false,
      error: { code: "future-version", actions: ["export"] },
    });
    repository.close();
  });

  it("reports unavailable and blocked opening with an ephemeral recovery action", async () => {
    const unavailable = new IndexedDbFairScreenRepository({
      factory: null,
      clock: new FixedClock(),
    });
    expect(await unavailable.open()).toMatchObject({
      ok: false,
      error: {
        code: "unavailable",
        actions: ["use-ephemeral-session", "export"],
      },
    });

    const blockedFailure: StorageFailure = {
      code: "blocked",
      operation: "open",
      recoverable: true,
      actions: ["retry", "use-ephemeral-session"],
    };
    const blocked = repositoryWith(new IDBFactory(), "blocked", (operation) =>
      operation === "open" ? blockedFailure : undefined,
    );
    await expect(blocked.open()).resolves.toEqual({
      ok: false,
      error: blockedFailure,
    });
  });

  it("stores a synthetic recording only through the infrastructure repository and deletes it narrowly", async () => {
    const factory = new IDBFactory();
    const name = "recording";
    const repository = repositoryWith(factory, name);
    await repository.open();
    const session = createSessionFixture();
    const response = createResponseFixture(session.id, "one", true);
    await repository.saveSession(session);
    await repository.saveResponse(response);
    const database = await openDatabase(factory, name);
    const recordings = new IndexedDbRecordingRepository(database);
    const blob = new Blob(["synthetic"], { type: "video/webm" });
    const saved = await recordings.saveAfterUserChoice({
      id: recordingId("recording:one"),
      responseId: response.id,
      mimeType: "video/webm",
      sizeBytes: byteCount(blob.size),
      durationMs: milliseconds(1_000),
      savedByUserAt: FIXED_TIMESTAMP,
      blob,
    });
    expect(saved.ok).toBe(true);

    const deleted = await repository.delete({
      kind: "recording",
      id: recordingId("recording:one"),
    });
    expect(deleted).toMatchObject({
      ok: true,
      value: { recordings: 1, responses: 0 },
    });
    expect(await recordings.get(recordingId("recording:one"))).toEqual({
      ok: true,
      value: null,
    });
    const updatedResponse = await repository.getResponse(response.id);
    expect(updatedResponse.ok && updatedResponse.value).not.toHaveProperty(
      "recording",
    );
    database.close();
    repository.close();
  });
});

async function openDatabase(
  factory: IDBFactory,
  name: string,
  version?: number,
): Promise<IDBDatabase> {
  return requestResult(
    version === undefined ? factory.open(name) : factory.open(name, version),
  );
}
