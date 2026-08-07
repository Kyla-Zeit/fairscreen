import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { FairScreenRepositoryProvider } from "../../app/FairScreenRepositoryProvider";
import { EphemeralFairScreenRepository } from "../../infrastructure/storage/ephemeral/EphemeralFairScreenRepository";
import {
  createQuestionFixture,
  createResponseFixture,
  createSessionFixture,
  FIXED_TIMESTAMP,
} from "../../infrastructure/storage/testing/domainFixtures";
import { SetupDraftProvider } from "../setup/SetupDraftProvider";
import { SavedSessionsPage } from "./SavedSessionsPage";

describe("SavedSessionsPage", () => {
  it("lists, searches, renames, and deletes locally saved sessions", async () => {
    const user = userEvent.setup();
    const repository = new EphemeralFairScreenRepository();
    await repository.open();
    const session = createSessionFixture("saved");
    const response = createResponseFixture(session.id, "saved");
    await repository.saveSession({
      ...session,
      responseIds: [response.id],
    });
    await repository.saveResponse(response);

    render(
      <FairScreenRepositoryProvider repository={repository}>
        <SetupDraftProvider>
          <MemoryRouter initialEntries={["/saved"]}>
            <Routes>
              <Route path="/saved" element={<SavedSessionsPage />} />
              <Route path="/interviews/new" element={<h1>Practice setup</h1>} />
              <Route
                path="/interviews/:sessionId/practice"
                element={<h1>Resumed practice</h1>}
              />
            </Routes>
          </MemoryRouter>
        </SetupDraftProvider>
      </FairScreenRepositoryProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Developer saved" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 of 1 questions")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search saved sessions"), "missing");
    expect(
      screen.getByRole("heading", { name: "No sessions match these controls" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    await user.click(screen.getByRole("button", { name: "Rename" }));
    const nameInput = screen.getByLabelText("Session name");
    await user.clear(nameInput);
    await user.type(nameInput, "Backend reliability practice");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(
      await screen.findByRole("heading", {
        name: "Backend reliability practice",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "No saved sessions yet" }),
      ).toBeInTheDocument();
    });
  });

  it("shows legacy partial records as ended early instead of complete", async () => {
    const repository = new EphemeralFairScreenRepository();
    await repository.open();
    const session = createSessionFixture("legacy-partial");
    const response = createResponseFixture(session.id, "legacy-partial");
    const secondQuestion = {
      ...createQuestionFixture("legacy-second"),
      order: 1,
    };
    await repository.saveSession({
      ...session,
      status: "complete",
      safeMachineState: "complete",
      questions: [...session.questions, secondQuestion],
      responseIds: [response.id],
      completedAt: FIXED_TIMESTAMP,
    });
    await repository.saveResponse(response);

    render(
      <FairScreenRepositoryProvider repository={repository}>
        <SetupDraftProvider>
          <MemoryRouter initialEntries={["/saved"]}>
            <Routes>
              <Route path="/saved" element={<SavedSessionsPage />} />
              <Route
                path="/interviews/:sessionId/practice"
                element={<h1>Resumed practice</h1>}
              />
            </Routes>
          </MemoryRouter>
        </SetupDraftProvider>
      </FairScreenRepositoryProvider>,
    );

    const heading = await screen.findByRole("heading", {
      name: "Developer legacy-partial",
    });
    const card = heading.closest("article");
    if (!card) throw new Error("Expected saved-session card");
    expect(within(card).getByText("Ended early")).toBeInTheDocument();
    expect(within(card).getByText("1 of 2 questions")).toBeInTheDocument();
    expect(within(card).queryByText("Complete")).not.toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "Resume" }),
    ).toBeInTheDocument();
  });

  it("refreshes when an interview checkpoint finishes saving", async () => {
    const repository = new EphemeralFairScreenRepository();
    await repository.open();

    render(
      <FairScreenRepositoryProvider repository={repository}>
        <SetupDraftProvider>
          <MemoryRouter initialEntries={["/saved"]}>
            <Routes>
              <Route path="/saved" element={<SavedSessionsPage />} />
            </Routes>
          </MemoryRouter>
        </SetupDraftProvider>
      </FairScreenRepositoryProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "No saved sessions yet" }),
    ).toBeInTheDocument();

    const session = createSessionFixture("late-checkpoint");
    await repository.saveSession(session);
    window.dispatchEvent(new Event("fairscreen:saved-sessions-changed"));

    expect(
      await screen.findByRole("heading", { name: "Developer late-checkpoint" }),
    ).toBeInTheDocument();
  });
});
