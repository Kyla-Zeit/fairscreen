import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import packageJson from "../../package.json";
import { App } from "./App";

afterEach(() => {
  window.location.hash = "";
});

describe("App shell", () => {
  it("renders semantic shell landmarks and public Home content", async () => {
    render(<App />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Secondary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Practice the interview. Question the scoring.",
      }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe("Home | FairScreen");
    });
    expect(
      screen.queryByText(/M01|M02|foundation only|placeholder-only/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      `Version ${packageJson.version}.`,
    );
  });

  it("moves focus to main content through the skip link", async () => {
    const user = userEvent.setup();
    render(<App />);

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    await user.click(skipLink);

    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("focuses the route heading after hash route navigation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Settings" }));

    const settingsHeading = await screen.findByRole("heading", {
      level: 1,
      name: "Settings",
    });
    await waitFor(() => {
      expect(settingsHeading).toHaveFocus();
    });
  });

  it("marks active navigation with aria-current and a non-color state", async () => {
    const user = userEvent.setup();
    render(<App />);

    const secondaryNav = screen.getByRole("navigation", { name: "Secondary" });
    await user.click(
      within(secondaryNav).getByRole("link", { name: "Privacy" }),
    );

    const activeLink = within(secondaryNav).getByRole("link", {
      name: "Privacy",
    });
    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(activeLink).toHaveClass("active");
  });

  it("keeps Home off the menu while the FairScreen wordmark links home", () => {
    render(<App />);

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(primaryNav).queryByRole("link", { name: "Home" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "FairScreen home" }),
    ).toHaveAttribute("href", "#/");
  });

  it.each([
    ["#/interviews/new", "Practice setup", "Practice", "Primary"],
    ["#/interviews/example/devices", "Check your setup", "Practice", "Primary"],
    [
      "#/interviews/example/practice",
      "Interview practice",
      "Practice",
      "Primary",
    ],
    ["#/interviews/example/report", "Practice report", "Practice", "Primary"],
    ["#/saved", "Saved sessions", "Saved", "Primary"],
    ["#/settings", "Settings", "Settings", "Secondary"],
    [
      "#/privacy",
      "Your practice data stays under your control",
      "Privacy",
      "Secondary",
    ],
    ["#/methodology", "Methodology and limits", "Methodology", "Secondary"],
    [
      "#/accessibility",
      "Accessibility and alternatives",
      "Accessibility",
      "Secondary",
    ],
  ])(
    "renders route %s with a unique title, H1, and nav state",
    async (hash, heading, activeLink, navName) => {
      window.location.hash = hash;
      render(<App />);

      expect(
        await screen.findByRole("heading", { level: 1, name: heading }),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(document.title).toBe(`${headingTitle(heading)} | FairScreen`);
      });

      const nav = screen.getByRole("navigation", { name: navName });
      const activeNavLink = within(nav).getByRole("link", {
        name: activeLink,
      });
      expect(activeNavLink).toHaveAttribute("aria-current", "page");
      expect(activeNavLink).toHaveClass("active");
    },
  );

  it("uses exact critical copy and CTA destinations on completed education routes", () => {
    render(<App />);

    expect(
      screen.getByText(
        "FairScreen helps you practice automated interviews and strengthen the substance of your answers. It can describe certain video-call conditions, but it never treats gaze, expression, movement, or speaking style as evidence of confidence, honesty, personality, or competence.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your video is not uploaded to FairScreen. Camera analysis runs in your browser, frame-level landmarks are discarded, and recordings are saved only when you choose. Browser speech recognition may use a vendor service; FairScreen asks before using it.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Start a practice interview" })[0],
    ).toHaveAttribute("href", "#/interviews/new");
    expect(
      screen.getAllByRole("link", { name: "Review saved sessions" })[0],
    ).toHaveAttribute("href", "#/saved");
  });

  it("redirects the removed Fairness Lab route to Methodology", async () => {
    window.location.hash = "#/fairness";
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Methodology and limits",
      }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/methodology");
  });

  it("redirects legacy Practise URLs to the corrected Practice route", async () => {
    window.location.hash = "#/interviews/example/practise";
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Interview practice",
      }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/interviews/example/practice");
  });

  it("validates setup input and preserves it through device review navigation", async () => {
    const user = userEvent.setup();
    window.location.hash = "#/interviews/new";
    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: "Review devices and start" }),
    );

    const errorSummary = await screen.findByRole("alert");
    expect(errorSummary).toHaveFocus();
    expect(screen.getAllByText("Job title is required.")).toHaveLength(2);

    await user.type(screen.getByLabelText(/Job title/), "Product analyst");
    await user.click(
      screen.getByRole("checkbox", { name: "Use camera during setup" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Review devices and start" }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Check your setup",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Camera review selected.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change setup" }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice setup",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Job title/)).toHaveValue("Product analyst");
  });

  it("exposes education-page disclosures through native details", async () => {
    const user = userEvent.setup();
    window.location.hash = "#/methodology";
    render(<App />);

    const disclosureSummary = screen.getByText(
      "What optional measurements mean",
    );
    const disclosure = disclosureSummary.closest("details");
    expect(disclosure).not.toHaveAttribute("open");

    await user.click(disclosureSummary);

    expect(disclosure).toHaveAttribute("open");
  });

  it("opens and closes the accessible mobile menu with Escape and focus return", async () => {
    const user = userEvent.setup();
    render(<App />);

    const menuButton = screen.getByRole("button", { name: "Menu" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await user.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("dialog", { name: "FairScreen menu" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(menuButton).toHaveAttribute("aria-expanded", "false");
      expect(menuButton).toHaveFocus();
    });
  });

  it("renders the unknown-route recovery page", async () => {
    window.location.hash = "#/does-not-exist";
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "That FairScreen page was not found",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute(
      "href",
      "#/",
    );
  });
});

function headingTitle(heading: string) {
  if (heading === "Practice the interview. Question the scoring.") {
    return "Home";
  }

  if (heading === "That FairScreen page was not found") {
    return heading;
  }

  if (heading === "Check your setup") {
    return "Device check";
  }

  if (heading === "Your practice data stays under your control") {
    return "Privacy";
  }

  if (heading === "Methodology and limits") {
    return "Methodology";
  }

  if (heading === "Accessibility and alternatives") {
    return "Accessibility";
  }

  return heading;
}
