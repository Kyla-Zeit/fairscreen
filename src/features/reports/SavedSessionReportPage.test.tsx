import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { FairScreenRepositoryProvider } from "../../app/FairScreenRepositoryProvider";
import { isoDateTime } from "../../domain/factories";
import { EphemeralFairScreenRepository } from "../../infrastructure/storage/ephemeral/EphemeralFairScreenRepository";
import {
  createResponseFixture,
  createSessionFixture,
} from "../../infrastructure/storage/testing/domainFixtures";
import { createManualTranscriptResult } from "../transcription/transcription";
import { SetupDraftProvider } from "../setup/SetupDraftProvider";
import { SavedSessionReportPage } from "./SavedSessionReportPage";

describe("SavedSessionReportPage", () => {
  it("regenerates content coaching and shows a stronger answer from a reviewed transcript", async () => {
    const repository = new EphemeralFairScreenRepository();
    await repository.open();
    const session = createSessionFixture("report-coaching");
    const baseResponse = createResponseFixture(session.id, "report-coaching");
    const transcriptText =
      "I investigated an intermittent application failure by reviewing logs, reproducing the issue, and tracing the request through the service. I found that a dependency timeout was not handled consistently, so I added a safe fallback, clearer error handling, and automated tests. The change allowed users to continue with reduced functionality and gave the team enough diagnostic information to resolve the underlying dependency problem.";
    const response = {
      ...baseResponse,
      status: "saved" as const,
      transcript: createManualTranscriptResult({
        revisionKey: "saved-report",
        createdAt: isoDateTime("2026-01-01T00:00:00.000Z"),
        text: transcriptText,
        locale: "en-CA",
      }),
      userNotes: `  ${transcriptText.replaceAll(" ", "  ")}  `,
    };
    await repository.saveSession({
      ...session,
      status: "complete",
      safeMachineState: "complete",
      responseIds: [response.id],
      completedAt: isoDateTime("2026-01-01T00:00:00.000Z"),
    });
    await repository.saveResponse(response);

    render(
      <FairScreenRepositoryProvider repository={repository}>
        <SetupDraftProvider>
          <MemoryRouter
            initialEntries={[
              `/saved/${encodeURIComponent(String(session.id))}/report`,
            ]}
          >
            <Routes>
              <Route
                path="/saved/:sessionId/report"
                element={<SavedSessionReportPage />}
              />
            </Routes>
          </MemoryRouter>
        </SetupDraftProvider>
      </FairScreenRepositoryProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Suggested stronger answer" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Content coaching not available"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "No microphone-based delivery observations were saved for this attempt.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No camera-based video-call observations were saved for this attempt.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Answer notes" }),
    ).not.toBeInTheDocument();
  });

  it("shows answer notes when they contain separate private context", async () => {
    const repository = new EphemeralFairScreenRepository();
    await repository.open();
    const session = createSessionFixture("report-distinct-notes");
    const baseResponse = createResponseFixture(
      session.id,
      "report-distinct-notes",
    );
    const response = {
      ...baseResponse,
      status: "saved" as const,
      transcript: createManualTranscriptResult({
        revisionKey: "saved-report-distinct-notes",
        createdAt: isoDateTime("2026-01-01T00:00:00.000Z"),
        text: "I described the steps I took and the result.",
        locale: "en-CA",
      }),
      userNotes:
        "Mention the customer follow-up if this question appears again.",
    };
    await repository.saveSession({
      ...session,
      status: "complete",
      safeMachineState: "complete",
      responseIds: [response.id],
      completedAt: isoDateTime("2026-01-01T00:00:00.000Z"),
    });
    await repository.saveResponse(response);

    render(
      <FairScreenRepositoryProvider repository={repository}>
        <SetupDraftProvider>
          <MemoryRouter
            initialEntries={[
              `/saved/${encodeURIComponent(String(session.id))}/report`,
            ]}
          >
            <Routes>
              <Route
                path="/saved/:sessionId/report"
                element={<SavedSessionReportPage />}
              />
            </Routes>
          </MemoryRouter>
        </SetupDraftProvider>
      </FairScreenRepositoryProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Answer notes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Mention the customer follow-up if this question appears again.",
      ),
    ).toBeInTheDocument();
  });
});
