import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  BrowserServicesProvider,
  type BrowserServices,
} from "../../app/BrowserServicesProvider";
import type {
  InterviewQuestion,
  QuestionGenerationRequest,
} from "../../domain/models";
import type { QuestionProvider } from "../../domain/ports";
import { createUnknownCapabilityReport } from "../../infrastructure/browser/capabilities";
import { createUnavailableTranscriptionProvider } from "../../infrastructure/browser/speechRecognition";
import { createDeterministicAnswerAnalyzer } from "../analysis/DeterministicAnswerAnalyzer";
import { QuestionProviderProvider } from "../questions/QuestionProviderContext";
import type { CompanyResearchSnapshot } from "./jobContext";
import { SetupDraftProvider } from "./SetupDraftProvider";
import { SetupPage } from "./SetupPage";
import { createDefaultSetupDraft, type SetupDraft } from "./setupDraft";

describe("SetupPage resume file import", () => {
  it("stages extracted text in a read-only preview and commits only after confirmation", async () => {
    const user = userEvent.setup();
    const importResumeFile = vi.fn().mockResolvedValue({
      ok: true,
      format: "txt",
      text: "Imported resume text",
    });
    const provider = createQuestionProvider();
    renderSetupPage({
      services: createBrowserServices({ importResumeFile }),
      provider,
    });

    expect(
      screen.queryByRole("textbox", { name: "Resume text" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Paste only the resume/i),
    ).not.toBeInTheDocument();

    await user.upload(
      screen.getByLabelText("Choose résumé file"),
      new File(["Imported resume text"], "resume.txt", { type: "text/plain" }),
    );

    expect(
      await screen.findByText(/Résumé text was extracted locally/),
    ).toBeInTheDocument();
    expect(screen.getByText("TXT")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(provider.generateSpy).not.toHaveBeenCalled();

    const previewDisclosure = screen
      .getByText("Preview extracted plain text")
      .closest("details");
    expect(previewDisclosure).not.toBeNull();
    expect(previewDisclosure).not.toHaveAttribute("open");
    expect(screen.getByText("Imported resume text").tagName).toBe("PRE");

    await user.click(screen.getByRole("button", { name: "Use this résumé" }));
    expect(
      await screen.findByText("Résumé selected for question generation."),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Job title/), "Product analyst");
    await user.click(
      screen.getByRole("button", { name: "Generate question set" }),
    );

    await waitFor(() => {
      expect(provider.generateSpy).toHaveBeenCalledTimes(1);
    });
    const request = provider.generateSpy.mock.calls[0]?.[0] as
      QuestionGenerationRequest | undefined;
    expect(request?.context.resumeText).toBe("Imported resume text");
  });

  it("asks before replacing a confirmed resume and supports cancellation", async () => {
    const user = userEvent.setup();
    const importResumeFile = vi.fn().mockResolvedValue({
      ok: true,
      format: "txt",
      text: "Replacement text",
    });
    renderSetupPage({
      services: createBrowserServices({ importResumeFile }),
      initialDraft: {
        ...createDefaultSetupDraft(),
        resumeText: "Existing text",
      },
    });

    const fileInput = screen.getByLabelText("Choose résumé file");
    await user.upload(fileInput, new File(["Replacement text"], "resume.txt"));
    expect(
      screen.getByRole("group", { name: "Replace résumé confirmation" }),
    ).toBeInTheDocument();
    expect(importResumeFile).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Keep current résumé" }),
    );
    expect(
      screen.getByText("Replacement canceled. The selected résumé was kept."),
    ).toBeInTheDocument();

    await user.upload(fileInput, new File(["Replacement text"], "resume.txt"));
    await user.click(screen.getByRole("button", { name: "Replace résumé" }));

    expect(
      await screen.findByText(/Résumé text was extracted locally/),
    ).toBeInTheDocument();
    expect(importResumeFile).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Use this résumé" }));
    expect(
      await screen.findByText("Résumé selected for question generation."),
    ).toBeInTheDocument();
  });

  it("moves focus to actionable import errors", async () => {
    const user = userEvent.setup();
    renderSetupPage({
      services: createBrowserServices({
        importResumeFile: vi.fn().mockResolvedValue({
          ok: false,
          failure: {
            code: "unsupported-format",
            message: "Upload a supported résumé file: PDF, DOCX, or TXT.",
          },
        }),
      }),
    });

    await user.upload(
      screen.getByLabelText("Choose résumé file"),
      new File(["x"], "resume.txt"),
    );

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Upload a supported résumé file");
    await waitFor(() => {
      expect(error).toHaveFocus();
    });
  });

  it("resets the input so the same file can be selected again", async () => {
    const user = userEvent.setup();
    const importResumeFile = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, format: "txt", text: "First" })
      .mockResolvedValueOnce({ ok: true, format: "txt", text: "Second" });
    renderSetupPage({ services: createBrowserServices({ importResumeFile }) });
    const fileInput = screen.getByLabelText("Choose résumé file");
    const file = new File(["same"], "resume.txt", { type: "text/plain" });

    await user.upload(fileInput, file);
    await user.upload(fileInput, file);

    expect(importResumeFile).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Second").tagName).toBe("PRE");
  });

  it("invalidates stale generated questions only when the extracted resume is confirmed", async () => {
    const user = userEvent.setup();
    const provider = createQuestionProvider();
    const generatedQuestion = createQuestion("q:old", "Old question?");
    const initialDraft: SetupDraft = {
      ...createDefaultSetupDraft(),
      jobTitle: "Product analyst",
      generatedQuestions: [generatedQuestion],
      extractedKeywords: [
        {
          normalized: "old",
          display: "old",
          source: "resume",
          weight: 1,
          kind: "skill",
        },
      ],
      questionSelectionReasons: [
        {
          questionId: generatedQuestion.id,
          reason: "keyword-adapted",
          details: ["Old resume context."],
        },
      ],
    };
    renderSetupPage({
      initialDraft,
      provider,
      services: createBrowserServices({
        importResumeFile: vi.fn().mockResolvedValue({
          ok: true,
          format: "txt",
          text: "SQL accessibility testing",
        }),
      }),
    });

    expect(screen.getByText("Old question?")).toBeInTheDocument();
    await user.upload(
      screen.getByLabelText("Choose résumé file"),
      new File(["new"], "resume.txt"),
    );
    expect(screen.getByText("Old question?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Use this résumé" }));

    await waitFor(() => {
      expect(screen.queryByText("Old question?")).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Question set cleared/)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Generate question set" }),
    );

    expect(provider.generateSpy).toHaveBeenCalledTimes(1);
    const request = provider.generateSpy.mock.calls[0]?.[0] as
      QuestionGenerationRequest | undefined;
    expect(request?.context.resumeText).toBe("SQL accessibility testing");
  });

  it("removes confirmed resumes and clears generated questions", async () => {
    const user = userEvent.setup();
    const generatedQuestion = createQuestion("q:old", "Old question?");
    renderSetupPage({
      initialDraft: {
        ...createDefaultSetupDraft(),
        resumeText: "Confirmed resume",
        generatedQuestions: [generatedQuestion],
      },
    });

    await user.click(screen.getByRole("button", { name: "Remove résumé" }));

    expect(
      screen.getByText("Résumé removed. Choose a file to add one."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Old question?")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Use this résumé" }),
    ).not.toBeInTheDocument();
  });

  it("shows safe resume filename metadata without paths or raw source objects", async () => {
    const user = userEvent.setup();
    const { container } = renderSetupPage({
      services: createBrowserServices({
        importResumeFile: vi.fn().mockResolvedValue({
          ok: true,
          format: "txt",
          text: "Reviewed plain text",
        }),
      }),
    });

    await user.upload(
      screen.getByLabelText("Choose résumé file"),
      new File(["private text"], "sensitive-name.txt", { type: "text/plain" }),
    );

    expect(screen.getByText("sensitive-name.txt")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("C:\\");
    expect(container.innerHTML).not.toContain("/Users/");
    expect(container.innerHTML).not.toContain("ArrayBuffer");
    expect(container.innerHTML).not.toContain("Blob");
  });
});

describe("SetupPage job context and company research", () => {
  it("normalizes job posting URLs and imports only after explicit action", async () => {
    const user = userEvent.setup();
    const originalJobUrl = " " + "HTTPS" + "://Example.com/jobs/123#apply ";
    const normalizedJobUrl = webUrl("example.com/jobs/123");
    const companyWebsiteUrl = webUrl("example.com/");
    const importJobPosting = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        originalUrl: originalJobUrl,
        normalizedUrl: normalizedJobUrl,
        importedAt: "2026-01-01T00:00:00.000Z",
        title: "Product analyst",
        companyName: "Example Co",
        companyWebsiteUrl,
        location: "Remote",
        description: "Analyze product signals.",
      },
    });
    renderSetupPage({
      services: createBrowserServices({ importJobPosting }),
    });

    await user.type(screen.getByLabelText("Job posting URL"), originalJobUrl);
    expect(importJobPosting).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Import job posting" }),
    );

    await waitFor(() => {
      expect(importJobPosting).toHaveBeenCalledTimes(1);
    });
    expect(importJobPosting.mock.calls[0]?.[0]).toMatchObject({
      originalUrl: originalJobUrl,
      normalizedUrl: normalizedJobUrl,
    });
    expect(screen.getByText("Review imported job posting")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Use imported fields" }),
    );

    expect(screen.getByLabelText(/Job title/)).toHaveValue("Product analyst");
    expect(screen.getByLabelText("Company name")).toHaveValue("Example Co");
    expect(screen.getByLabelText("Company website URL")).toHaveValue(
      companyWebsiteUrl,
    );
    expect(screen.getByLabelText("Job description")).toHaveValue(
      "Analyze product signals.",
    );
  });

  it("keeps blocked job posting URLs and offers paste fallback", async () => {
    const user = userEvent.setup();
    const blockedJobUrl = webUrl("example.com/jobs/blocked");
    const importJobPosting = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: "anti-bot-blocked",
        message:
          "The posting could not be imported because the site blocked automated access. Paste the job description instead.",
        retrievedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    renderSetupPage({
      services: createBrowserServices({ importJobPosting }),
    });

    await user.type(screen.getByLabelText("Job posting URL"), blockedJobUrl);
    await user.click(
      screen.getByRole("button", { name: "Import job posting" }),
    );

    expect(
      await screen.findByText(/site blocked automated access/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Job posting URL")).toHaveValue(blockedJobUrl);

    await user.click(
      screen.getByRole("button", { name: "Paste job description instead" }),
    );
    expect(screen.getByLabelText("Job description")).toHaveFocus();
  });

  it("requires research consent and excludes private setup data from the payload", async () => {
    const user = userEvent.setup();
    const research = vi.fn().mockResolvedValue({
      ok: true,
      value: companyResearchFixture(),
    });
    renderSetupPage({
      initialDraft: {
        ...createDefaultSetupDraft(),
        resumeText: "Private resume text",
      },
      services: createBrowserServices({
        companyResearch: { providerId: "fake-research", research },
      }),
    });

    await user.type(screen.getByLabelText(/Job title/), "Product analyst");
    await user.type(screen.getByLabelText("Company name"), "Example Co");
    await user.click(screen.getByRole("button", { name: "Research company" }));

    expect(research).not.toHaveBeenCalled();
    expect(screen.getByText("Research consent")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "I agree, research company" }),
    );

    await waitFor(() => {
      expect(research).toHaveBeenCalledTimes(1);
    });
    const payload: unknown = research.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      companyName: "Example Co",
      jobTitle: "Product analyst",
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /resume|answer|recording|transcript|camera|microphone|Private/i,
    );
    expect(await screen.findByText("Verified company")).toBeInTheDocument();
  });

  it("asks users to resolve ambiguous company names instead of guessing", async () => {
    const user = userEvent.setup();
    renderSetupPage({
      services: createBrowserServices({
        companyResearch: {
          providerId: "fake-research",
          research: vi.fn().mockResolvedValue({
            ok: false,
            error: {
              code: "ambiguous-company",
              message: "Select the correct organization before researching.",
              candidates: [
                {
                  id: "one",
                  name: "Example Health",
                  websiteUrl: webUrl("health.example/"),
                  reason: "Healthcare company.",
                },
                {
                  id: "two",
                  name: "Example Labs",
                  websiteUrl: webUrl("labs.example/"),
                  reason: "Software company.",
                },
              ],
            },
          }),
        },
      }),
    });

    await user.type(screen.getByLabelText("Company name"), "Example");
    await user.click(screen.getByRole("button", { name: "Research company" }));
    await user.click(
      screen.getByRole("button", { name: "I agree, research company" }),
    );

    expect(await screen.findByText("Example Health")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Example Labs/ }));

    expect(screen.getByLabelText("Company name")).toHaveValue("Example Labs");
    expect(screen.getByLabelText("Company website URL")).toHaveValue(
      webUrl("labs.example/"),
    );
  });

  it("feeds included research practice questions into local generation", async () => {
    const user = userEvent.setup();
    const provider = createQuestionProvider();
    renderSetupPage({
      provider,
      services: createBrowserServices({
        companyResearch: {
          providerId: "fake-research",
          research: vi.fn().mockResolvedValue({
            ok: true,
            value: companyResearchFixture(),
          }),
        },
      }),
    });

    await user.type(screen.getByLabelText(/Job title/), "Product analyst");
    await user.type(screen.getByLabelText("Company name"), "Example Co");
    await user.click(screen.getByRole("button", { name: "Research company" }));
    await user.click(
      screen.getByRole("button", { name: "I agree, research company" }),
    );
    expect(await screen.findAllByText("Sourced fact")).toHaveLength(2);
    await user.click(
      screen.getByRole("checkbox", { name: /Public-service users/ }),
    );
    await user.click(
      screen.getByRole("button", { name: "Generate question set" }),
    );

    await waitFor(() => {
      expect(provider.generateSpy).toHaveBeenCalledTimes(1);
    });
    const request = provider.generateSpy.mock.calls[0]?.[0] as
      QuestionGenerationRequest | undefined;
    expect(request?.customQuestions.map((question) => question.text)).toEqual(
      expect.arrayContaining([
        "Why are you interested in Example Co and its work?",
        "Tell me about a time you demonstrated Accessibility.",
      ]),
    );
    expect(
      request?.customQuestions.some((question) =>
        question.text.includes("Public-service users"),
      ),
    ).toBe(false);
  });
});

function renderSetupPage({
  initialDraft,
  provider = createQuestionProvider(),
  services = createBrowserServices(),
}: {
  readonly initialDraft?: SetupDraft;
  readonly provider?: MockQuestionProvider;
  readonly services?: BrowserServices;
} = {}) {
  return render(
    <MemoryRouter initialEntries={["/interviews/new"]}>
      <BrowserServicesProvider services={services}>
        <QuestionProviderProvider provider={provider}>
          <SetupDraftProvider
            {...(initialDraft === undefined ? {} : { initialDraft })}
          >
            <SetupPage />
          </SetupDraftProvider>
        </QuestionProviderProvider>
      </BrowserServicesProvider>
    </MemoryRouter>,
  );
}

type MockQuestionProvider = QuestionProvider & {
  readonly generateSpy: ReturnType<typeof vi.fn>;
};

function createQuestionProvider(): MockQuestionProvider {
  const generateSpy = vi.fn((request: QuestionGenerationRequest) =>
    Promise.resolve({
      questions: [
        createQuestion("q:new", `Question for ${request.context.jobTitle}?`),
      ],
      extractedKeywords: [],
      selectionReasons: [],
      warnings: [],
      providerId: "test-provider",
      providerVersion: "1",
    }),
  );

  return {
    providerId: "test-provider",
    providerVersion: "1",
    generate: generateSpy,
    generateSpy,
  };
}

function createBrowserServices(
  overrides: Partial<BrowserServices> = {},
): BrowserServices {
  return {
    capabilities: {
      getReport: vi.fn().mockResolvedValue(createUnknownCapabilityReport()),
    },
    mediaDevices: {
      enumerateDevices: vi.fn().mockResolvedValue([]),
      requestCamera: vi.fn(),
      requestMicrophone: vi.fn(),
      stopStream: vi.fn(),
    },
    createMicrophoneLevelMonitor: vi.fn(),
    startAudioMetricSession: vi.fn().mockResolvedValue({
      ok: false,
      reason: "unsupported",
    }),
    startRecorderSession: vi.fn(() => ({
      ok: false as const,
      code: "unsupported" as const,
    })),
    startVideoAnalysisSession: vi.fn().mockResolvedValue({
      ok: false,
      reason: "unsupported",
      message: "Video analysis unavailable in this test.",
    }),
    saveRecordingAfterUserChoice: vi.fn(),
    importResumeFile: vi.fn().mockResolvedValue({
      ok: false,
      failure: {
        code: "unsupported-format",
        message: "Upload a supported résumé file: PDF, DOCX, or TXT.",
      },
    }),
    importJobPosting: vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: "provider-unavailable",
        message: "Job posting import unavailable.",
        retrievedAt: "2026-01-01T00:00:00.000Z",
      },
    }),
    companyResearch: {
      providerId: "test-company-research",
      research: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: "provider-unavailable",
          message: "Company research unavailable.",
        },
      }),
    },
    transcription: createUnavailableTranscriptionProvider(),
    answerAnalyzer: createDeterministicAnswerAnalyzer(),
    ...overrides,
  };
}

function companyResearchFixture(): CompanyResearchSnapshot {
  return {
    providerId: "fake-research",
    retrievedAt:
      "2026-01-01T00:00:00.000Z" as CompanyResearchSnapshot["retrievedAt"],
    verifiedCompanyName: "Example Co",
    officialWebsiteUrl: webUrl("example.com/"),
    overview: "Example Co builds local-first hiring tools.",
    findings: [
      {
        id: "value-accessibility",
        label: "Accessibility",
        text: "Example Co publicly lists accessibility as a product value.",
        kind: "values",
        evidence: "sourced-fact",
        included: true,
        sourceIndexes: [0],
      },
      {
        id: "product-public-service",
        label: "Public-service users",
        text: "Its products support public-service teams.",
        kind: "products",
        evidence: "sourced-fact",
        included: true,
        sourceIndexes: [0],
      },
      {
        id: "theme-collaboration",
        label: "Collaboration",
        text: "Some candidates report collaboration prompts.",
        kind: "interview-theme",
        evidence: "anecdotal",
        included: true,
        sourceIndexes: [1],
      },
    ],
    practiceQuestions: [
      "How would you approach accessibility trade-offs for Example Co users?",
    ],
    sources: [
      {
        title: "Example Co About",
        url: webUrl("example.com/about"),
        publisher: "example.com",
        retrievedAt:
          "2026-01-01T00:00:00.000Z" as CompanyResearchSnapshot["retrievedAt"],
        supports: ["Accessibility", "Public-service users"],
      },
      {
        title: "Candidate reports",
        url: webUrl("interviews.example/example-co"),
        publisher: "interviews.example",
        retrievedAt:
          "2026-01-01T00:00:00.000Z" as CompanyResearchSnapshot["retrievedAt"],
        supports: ["Collaboration"],
      },
    ],
    limitations: ["Reported interview themes are anecdotal."],
  };
}

function webUrl(path: string): string {
  return "https" + "://" + path;
}

function createQuestion(id: string, text: string): InterviewQuestion {
  return {
    id: id as InterviewQuestion["id"],
    source: "built-in",
    text,
    normalizedText: text.toLowerCase(),
    category: "general-behavioural",
    difficulty: "standard",
    tags: ["introduction"],
    renderedKeywords: [],
    order: 0,
    providerId: "test-provider",
    providerVersion: "1",
  };
}
