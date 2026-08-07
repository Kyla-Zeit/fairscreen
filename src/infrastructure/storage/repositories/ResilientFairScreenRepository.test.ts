import { beforeEach, describe, expect, it } from "vitest";

import type { StorageFailure } from "../../../domain/ports";
import { EphemeralFairScreenRepository } from "../ephemeral/EphemeralFairScreenRepository";
import { createSessionFixture, FixedClock } from "../testing/domainFixtures";
import { LocalStorageFairScreenRepository } from "./LocalStorageFairScreenRepository";
import { ResilientFairScreenRepository } from "./ResilientFairScreenRepository";

const exampleCompanyUrl = ["https:", "", "example.com"].join("/");
const exampleJobUrl = [exampleCompanyUrl, "jobs", "123"].join("/");

beforeEach(() => {
  window.localStorage.clear();
});

describe("ResilientFairScreenRepository", () => {
  it("persists a session through localStorage when the primary write fails", async () => {
    const failure: StorageFailure = {
      code: "unavailable",
      operation: "save-session",
      recoverable: true,
      actions: ["retry", "use-ephemeral-session"],
    };
    const primary = new EphemeralFairScreenRepository({
      clock: new FixedClock(),
      failOperation: (operation) =>
        operation === "save-session" ? failure : undefined,
    });
    const repository = new ResilientFairScreenRepository({
      primary,
      fallback: new LocalStorageFairScreenRepository(window.localStorage),
    });
    const fixture = createSessionFixture();
    const session = {
      ...fixture,
      context: {
        ...fixture.context,
        company: "Example Company",
        companyWebsiteUrl: exampleCompanyUrl,
        jobPostingUrl: exampleJobUrl,
        jobPostingImport: {
          originalUrl: exampleJobUrl,
          normalizedUrl: exampleJobUrl,
          importedAt: fixture.createdAt,
        },
        resumeText: "Experienced investigator and developer.",
        resumeMetadata: {
          originalFilename: "resume.pdf",
          format: "pdf",
          fileSizeBytes: 1024,
          importedAt: fixture.createdAt,
          extractionStatus: "ready",
        },
        companyResearch: {
          providerId: "local-test",
          retrievedAt: fixture.createdAt,
          verifiedCompanyName: "Example Company",
          overview: "Example overview.",
          findings: [],
          practiceQuestions: [],
          sources: [],
          limitations: [],
        },
      },
    };

    expect(await repository.open()).toMatchObject({ ok: true });
    expect(await repository.saveSession(session)).toEqual({
      ok: true,
      value: undefined,
    });
    repository.close();

    const reopened = new ResilientFairScreenRepository({
      primary: new EphemeralFairScreenRepository({ clock: new FixedClock() }),
      fallback: new LocalStorageFairScreenRepository(window.localStorage),
    });
    expect(await reopened.open()).toMatchObject({ ok: true });
    await expect(reopened.getSession(session.id)).resolves.toEqual({
      ok: true,
      value: session,
    });
  });
});
