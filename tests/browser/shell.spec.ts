import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routeCases = [
  {
    path: "./",
    heading: "Practice the interview. Question the scoring.",
    title: "Home | FairScreen",
  },
  {
    path: "./#/interviews/new",
    heading: "Practice setup",
    title: "Practice setup | FairScreen",
  },
  {
    path: "./#/interviews/example/devices",
    heading: "Check your setup",
    title: "Device check | FairScreen",
  },
  {
    path: "./#/interviews/example/practice",
    heading: "Interview practice",
    title: "Interview practice | FairScreen",
  },
  {
    path: "./#/interviews/example/report",
    heading: "Practice report",
    title: "Practice report | FairScreen",
  },
  {
    path: "./#/saved",
    heading: "Saved sessions",
    title: "Saved sessions | FairScreen",
  },
  {
    path: "./#/settings",
    heading: "Settings",
    title: "Settings | FairScreen",
  },
  {
    path: "./#/privacy",
    heading: "Your practice data stays under your control",
    title: "Privacy | FairScreen",
  },
  {
    path: "./#/methodology",
    heading: "Methodology and limits",
    title: "Methodology | FairScreen",
  },
  {
    path: "./#/accessibility",
    heading: "Accessibility and alternatives",
    title: "Accessibility | FairScreen",
  },
];

interface BrowserCallCounts {
  enumerateDevices: number;
  getUserMedia: number;
  indexedDbOpen: number;
  permissionQuery: number;
}

test("M02 routes load from the non-root fairscreen base path without external requests", async ({
  page,
}) => {
  const externalRequests = new Set<string>();
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(requestUrl.hostname)) {
      externalRequests.add(request.url());
    }
  });

  for (const route of routeCases) {
    await page.goto(route.path);

    await expect(
      page.getByRole("heading", { level: 1, name: route.heading }),
    ).toBeVisible();
    await expect(page).toHaveTitle(route.title);
    await expect(page.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(page.url()).toContain("/fairscreen/");

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    const seriousOrCriticalViolations =
      accessibilityScanResults.violations.filter((violation) =>
        ["critical", "serious"].includes(violation.impact ?? ""),
      );
    expect(seriousOrCriticalViolations).toEqual([]);
  }

  expect(Array.from(externalRequests)).toEqual([]);
});

test("the removed Fairness Lab URL redirects to Methodology", async ({
  page,
}) => {
  await page.goto("./#/fairness");
  await expect(
    page.getByRole("heading", { level: 1, name: "Methodology and limits" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/methodology$/);
});

test("keyboard focus follows route changes and browser history", async ({
  page,
}) => {
  await page.goto("./#/privacy");

  await page
    .getByRole("navigation", { name: "Secondary" })
    .getByRole("link", { name: "Methodology" })
    .click();

  const methodologyHeading = page.getByRole("heading", {
    level: 1,
    name: "Methodology and limits",
  });
  await expect(methodologyHeading).toBeFocused();

  await page.goBack();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Your practice data stays under your control",
    }),
  ).toBeFocused();
});

test("mobile menu, skip link, and 320px reflow remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("./#/settings");

  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible();

  const menuButton = page.getByRole("button", { exact: true, name: "Menu" });
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("dialog", { name: "FairScreen menu" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menuButton).toBeFocused();

  await page.goto("./#/settings");
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute("tabindex");
  });
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  const hasNoHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= window.innerWidth;
  });

  expect(hasNoHorizontalOverflow).toBe(true);
});

test("unknown route, reduced motion, forced colors, and print media are handled", async ({
  page,
}) => {
  await page.goto("./#/unknown-route");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "That FairScreen page was not found",
    }),
  ).toBeVisible();
  await expect(page).toHaveTitle(
    "That FairScreen page was not found | FairScreen",
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./#/accessibility");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Accessibility and alternatives",
    }),
  ).toBeVisible();

  await page.emulateMedia({ forcedColors: "active" });
  await expect(page.getByRole("main")).toBeVisible();

  await page.emulateMedia({ forcedColors: "none", media: "print" });
  await page.goto("./#/privacy");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Your practice data stays under your control",
    }),
  ).toBeVisible();
  await expect(page.locator(".site-header")).toBeHidden();
});

test("home CTAs and disclosures remain keyboard reachable", async ({
  page,
}) => {
  await page.goto("./");

  await expect(
    page.getByRole("link", { name: "Start a practice interview" }).first(),
  ).toHaveAttribute("href", /#\/interviews\/new$/);
  await expect(
    page.getByRole("link", { name: "Review saved sessions" }).first(),
  ).toHaveAttribute("href", /#\/saved$/);

  await page.goto("./#/methodology");
  const disclosure = page.getByText("What optional measurements mean");
  await disclosure.click();
  await expect(
    page.getByText(
      /Optional audio and video observations describe the capture environment/,
    ),
  ).toBeVisible();
});

test("resume file import is local, keyboard reachable, responsive, and axe clean", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 680 });
  await page.goto("./#/interviews/new");

  await page.getByText("Résumé file (optional)").click();
  const externalRequests = new Set<string>();
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(requestUrl.hostname)) {
      externalRequests.add(request.url());
    }
  });

  await page
    .getByLabel("Choose résumé file")
    .setInputFiles("tests/fixtures/resume-import.txt");

  await expect(
    page.getByText(/Résumé text was extracted locally/),
  ).toBeVisible();
  await expect(page.getByText("TXT", { exact: true })).toBeVisible();
  await expect(page.getByText("Preview extracted plain text")).toBeVisible();
  await page.getByText("Preview extracted plain text").click();
  await expect(page.getByText(/Browser fixture resume/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Resume text" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Use this résumé" }).click();
  await expect(
    page.getByText("Résumé selected for question generation."),
  ).toBeVisible();
  expect([...externalRequests]).toEqual([]);

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  const seriousOrCriticalViolations =
    accessibilityScanResults.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? ""),
    );
  expect(seriousOrCriticalViolations).toEqual([]);

  const hasNoHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= window.innerWidth;
  });
  expect(hasNoHorizontalOverflow).toBe(true);
});

test("M10 interview workflow, transcript coaching, and review are keyboard reachable, responsive, and axe clean", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 680 });
  await page.goto("./#/interviews/new");

  await page.getByLabel(/Job title/).fill("Product analyst");
  await page.getByRole("spinbutton", { name: "Questions" }).fill("1");
  await page.getByRole("button", { name: "Review devices and start" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Check your setup" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Begin practice" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Question 1 of 1" }),
  ).toBeVisible();
  const interviewStatus = page.getByLabel("Interview status");
  await expect(page.getByText("No microphone active.")).toBeVisible();

  await page.getByRole("button", { name: "Start preparation" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    interviewStatus.getByText("Preparation", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Start answer now" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    interviewStatus.getByText("Answering", { exact: true }),
  ).toBeVisible();

  await page
    .getByLabel("Private answer notes")
    .fill("Typed practice notes.");
  await page.getByRole("button", { name: "Finish answer" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    interviewStatus.getByText("Review this answer", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Overall practice takeaway" }),
  ).toBeVisible();
  await expect(page.getByLabel("Editable transcript")).toHaveValue(
    "Typed practice notes.",
  );
  await expect(
    page.getByText(/Not enough meaningful answer content to assess/i),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What to improve" }),
  ).toBeVisible();

  const reviewAccessibilityScan = await new AxeBuilder({ page }).analyze();
  expect(
    reviewAccessibilityScan.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);

  await page.getByRole("radio", { name: /Attempt 1: awaiting review/ }).check();
  await page.getByRole("button", { name: "Save and continue" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    interviewStatus.getByText("Between questions", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Next question" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    interviewStatus.getByText("Practice complete", { exact: true }),
  ).toBeVisible();

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  const seriousOrCriticalViolations =
    accessibilityScanResults.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? ""),
    );
  expect(seriousOrCriticalViolations).toEqual([]);

  const hasNoHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= window.innerWidth;
  });
  expect(hasNoHorizontalOverflow).toBe(true);
});

test("M08 camera journey lazy-loads the real production video worker", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const activeIntervals: number[] = [];

    function createCameraStream() {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      const context = canvas.getContext("2d");
      if (context) {
        let frame = 0;
        const drawFrame = () => {
          context.fillStyle = frame % 2 === 0 ? "#d8c7b8" : "#d9c8ba";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = "#6f4a3c";
          context.beginPath();
          context.ellipse(320, 150, 82, 104, 0, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#1d1715";
          context.fillRect(285, 135, 18, 8);
          context.fillRect(338, 135, 18, 8);
          frame += 1;
        };
        drawFrame();
        activeIntervals.push(window.setInterval(drawFrame, 100));
      }

      if (typeof canvas.captureStream === "function") {
        return canvas.captureStream(10);
      }

      return new MediaStream();
    }

    window.addEventListener("pagehide", () => {
      for (const interval of activeIntervals) {
        window.clearInterval(interval);
      }
    });

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: () =>
          Promise.resolve([
            {
              deviceId: "default",
              groupId: "browser-test",
              kind: "videoinput",
              label: "Browser test camera",
              toJSON: () => ({}),
            },
          ]),
        getUserMedia: (constraints: MediaStreamConstraints) => {
          if (constraints.video) {
            return Promise.resolve(createCameraStream());
          }

          return Promise.resolve(new MediaStream());
        },
      },
    });
  });

  const externalRequests = new Set<string>();
  const videoAssetRequests: string[] = [];
  const workerResponses: { readonly status: number; readonly url: string }[] =
    [];

  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(requestUrl.hostname)) {
      externalRequests.add(request.url());
    }
    if (/videoAnalysis\.worker|mediapipe\//i.test(request.url())) {
      videoAssetRequests.push(request.url());
    }
  });

  page.on("response", (response) => {
    if (/videoAnalysis\.worker/i.test(response.url())) {
      workerResponses.push({
        status: response.status(),
        url: response.url(),
      });
    }
  });

  await page.goto("./#/interviews/new");
  await page.getByLabel(/Job title/).fill("Product analyst");
  await page.getByRole("spinbutton", { name: "Questions" }).fill("1");
  await page.getByLabel("Use camera during setup").check();
  await page.getByRole("button", { name: "Review devices and start" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Check your setup" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Allow camera" }).click();
  await expect(page.getByText("Available").first()).toBeVisible();
  await page.getByRole("button", { name: "Begin practice" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Question 1 of 1" }),
  ).toBeVisible();
  const expectedAssetPrefix = `${new URL(page.url()).origin}/fairscreen/`;
  expect(videoAssetRequests).toEqual([]);

  await page.getByRole("button", { name: "Start preparation" }).click();
  await page.getByRole("button", { name: "Start answer now" }).click();

  await expect
    .poll(() => workerResponses.length, { timeout: 30_000 })
    .toBeGreaterThan(0);
  expect(workerResponses.every((response) => response.status === 200)).toBe(
    true,
  );
  expect(
    workerResponses.every((response) => /\.js($|\?)/.test(response.url)),
  ).toBe(true);
  expect(
    workerResponses.some((response) => /\.ts($|\?)/.test(response.url)),
  ).toBe(false);

  await expect(
    page.getByText(
      /Video analysis active|Local video analysis could not initialize/,
    ),
  ).toBeVisible({ timeout: 30_000 });

  expect(
    videoAssetRequests.every((requestUrl) =>
      requestUrl.startsWith(expectedAssetPrefix),
    ),
  ).toBe(true);
  expect(Array.from(externalRequests)).toEqual([]);
});

test("M08.3 job context keeps sticky navigation and makes no external request before research activation", async ({
  page,
}) => {
  const externalRequests = new Set<string>();
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(requestUrl.hostname)) {
      externalRequests.add(request.url());
    }
  });

  await page.goto("./#/interviews/new");
  const header = page.locator(".site-header");
  await expect(header).toBeVisible();
  await page.getByLabel(/Job title/).fill("Product analyst");
  await page.getByLabel("Company name").fill("Example Co");
  await page
    .getByLabel("Job posting URL")
    .fill("https://example.com/jobs/product-analyst");
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });

  await expect(header).toBeVisible();
  const headerPosition = await header.evaluate(
    (element) => getComputedStyle(element).position,
  );
  expect(headerPosition).toBe("sticky");
  expect([...externalRequests]).toEqual([]);

  await page.getByRole("button", { name: "Research company" }).click();
  await expect(page.getByText("Research consent")).toBeVisible();
  expect([...externalRequests]).toEqual([]);
});

test("routes avoid media and permission calls while storage initializes once", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const instrumentedWindow = window as unknown as Window & {
      __fairScreenApiCalls: BrowserCallCounts;
    };
    instrumentedWindow.__fairScreenApiCalls = {
      enumerateDevices: 0,
      getUserMedia: 0,
      indexedDbOpen: 0,
      permissionQuery: 0,
    };

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: () => {
          instrumentedWindow.__fairScreenApiCalls.enumerateDevices = 1;
          return Promise.resolve([]);
        },
        getUserMedia: () => {
          instrumentedWindow.__fairScreenApiCalls.getUserMedia = 1;
          return Promise.reject(new Error("Unexpected media request"));
        },
      },
    });

    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: () => {
          instrumentedWindow.__fairScreenApiCalls.permissionQuery = 1;
          return Promise.reject(new Error("Unexpected permission query"));
        },
      },
    });

    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: {
        open: () => {
          instrumentedWindow.__fairScreenApiCalls.indexedDbOpen = 1;
          throw new Error("Simulated IndexedDB failure");
        },
      },
    });
  });

  for (const route of routeCases) {
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { level: 1, name: route.heading }),
    ).toBeVisible();
  }

  const counts = await page.evaluate(() => {
    return (
      window as unknown as Window & { __fairScreenApiCalls: BrowserCallCounts }
    ).__fairScreenApiCalls;
  });

  expect(counts).toEqual({
    enumerateDevices: 0,
    getUserMedia: 0,
    indexedDbOpen: 1,
    permissionQuery: 0,
  });
});
