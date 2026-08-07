import { describe, expect, it } from "vitest";

import {
  DEMO_COMPARISON_ID,
  DEMO_TRIAL_IDS,
  removeDemoData,
  seedDemoData,
} from "../../../features/demo/seed";
import { createDefaultUserSettings } from "../../../features/settings/defaults";
import { interviewSessionId } from "../../../domain/factories";
import type { StorageFailure } from "../../../domain/ports";
import {
  createResponseFixture,
  createSessionFixture,
  FixedClock,
} from "../testing/domainFixtures";
import { EphemeralFairScreenRepository } from "./EphemeralFairScreenRepository";

describe("ephemeral repository", () => {
  it("implements save, clone, list, and settings through the shared port", async () => {
    const repository = new EphemeralFairScreenRepository({
      clock: new FixedClock(),
    });
    await expect(repository.open()).resolves.toEqual({
      ok: true,
      value: {
        mode: "ephemeral",
        databaseVersion: 2,
        supportedVersion: 2,
      },
    });

    const session = createSessionFixture();
    const response = createResponseFixture(session.id);
    expect((await repository.saveSession(session)).ok).toBe(true);
    expect((await repository.saveResponse(response)).ok).toBe(true);

    const storedSession = await repository.getSession(session.id);
    expect(storedSession).toEqual({ ok: true, value: session });
    if (storedSession.ok && storedSession.value) {
      expect(Object.isFrozen(storedSession.value)).toBe(true);
    }

    const list = await repository.listSessions(
      { text: "developer project", sort: "updated-desc" },
      { pageSize: 20 },
    );
    expect(list.ok && list.value.values).toEqual([session]);
    expect(await repository.getSettings()).toEqual({
      ok: true,
      value: createDefaultUserSettings(new FixedClock()),
    });
  });

  it("does not mutate stored state when a write reports failure", async () => {
    let failCommit = false;
    const quotaFailure: StorageFailure = {
      code: "quota-exceeded",
      operation: "save-session:commit",
      recoverable: true,
      actions: ["export", "delete-selected-data"],
    };
    const repository = new EphemeralFairScreenRepository({
      clock: new FixedClock(),
      failOperation: (operation) =>
        failCommit && operation === "save-session:commit"
          ? quotaFailure
          : undefined,
    });
    await repository.open();
    const original = createSessionFixture();
    await repository.saveSession(original);
    failCommit = true;
    const changed = {
      ...original,
      context: { ...original.context, jobTitle: "Changed title" },
    };

    await expect(repository.saveSession(changed)).resolves.toEqual({
      ok: false,
      error: quotaFailure,
    });
    await expect(repository.getSession(original.id)).resolves.toEqual({
      ok: true,
      value: original,
    });
  });

  it("isolates corrupt records and exposes privacy-safe quarantine metadata", async () => {
    const repository = new EphemeralFairScreenRepository({
      clock: new FixedClock(),
    });
    await repository.open();
    repository.injectUntrustedRecord("sessions", "session:corrupt", {
      schemaVersion: 1,
      id: "session:corrupt",
      rawPixels: [1, 2, 3],
    });

    const read = await repository.getSession(
      interviewSessionId("session:corrupt"),
    );
    expect(read.ok).toBe(false);
    const quarantine = await repository.listQuarantinedRecords();
    expect(quarantine).toEqual({
      ok: true,
      value: [
        {
          storeName: "sessions",
          key: "session:corrupt",
          detectedAt: "2026-01-01T00:00:00.000Z",
          schemaVersion: 1,
          reasonCode: "schema-invalid",
        },
      ],
    });
    expect(JSON.stringify(quarantine)).not.toContain("rawPixels");
  });

  it("keeps future-version repositories read-only", async () => {
    const repository = new EphemeralFairScreenRepository({
      clock: new FixedClock(),
      databaseVersion: 3,
    });
    await expect(repository.open()).resolves.toEqual({
      ok: true,
      value: {
        mode: "read-only-recovery",
        databaseVersion: 3,
        supportedVersion: 2,
      },
    });
    const result = await repository.saveSession(createSessionFixture());
    expect(result).toMatchObject({
      ok: false,
      error: { code: "future-version", actions: ["export"] },
    });
  });

  it("seeds and removes deterministic demo records without touching user data", async () => {
    const repository = new EphemeralFairScreenRepository({
      clock: new FixedClock(),
    });
    await repository.open();
    const userSession = createSessionFixture("user");
    await repository.saveSession(userSession);

    await expect(seedDemoData(repository)).resolves.toEqual({
      ok: true,
      value: { loaded: true },
    });
    await expect(seedDemoData(repository)).resolves.toEqual({
      ok: true,
      value: { loaded: false },
    });
    expect(
      (await repository.getFairnessComparison(DEMO_COMPARISON_ID)).ok,
    ).toBe(true);
    for (const trialId of DEMO_TRIAL_IDS) {
      expect((await repository.getFairnessTrial(trialId)).ok).toBe(true);
    }

    const removed = await removeDemoData(repository);
    expect(removed).toMatchObject({
      ok: true,
      value: { fairnessComparisons: 1, fairnessTrials: 4 },
    });
    await expect(
      repository.getFairnessComparison(DEMO_COMPARISON_ID),
    ).resolves.toEqual({ ok: true, value: null });
    await expect(repository.getSession(userSession.id)).resolves.toEqual({
      ok: true,
      value: userSession,
    });
  });

  it("keeps settings when data deletion excludes them and resets only explicitly", async () => {
    const repository = new EphemeralFairScreenRepository({
      clock: new FixedClock(),
    });
    await repository.open();
    const defaults = createDefaultUserSettings(new FixedClock());
    const highContrast = {
      ...defaults,
      contrast: "high" as const,
    };
    await repository.saveSettings(highContrast);
    const session = createSessionFixture();
    await repository.saveSession(session);

    await expect(repository.resetSettings()).resolves.toEqual({
      ok: true,
      value: defaults,
    });
    await expect(repository.getSession(session.id)).resolves.toEqual({
      ok: true,
      value: session,
    });

    await repository.saveSettings(highContrast);
    await repository.delete({ kind: "all-data", includeSettings: false });
    await expect(repository.getSettings()).resolves.toEqual({
      ok: true,
      value: highContrast,
    });
    await expect(repository.getSession(session.id)).resolves.toEqual({
      ok: true,
      value: null,
    });

    await repository.delete({ kind: "all-data", includeSettings: true });
    await expect(repository.getSettings()).resolves.toEqual({
      ok: true,
      value: defaults,
    });
  });
});
