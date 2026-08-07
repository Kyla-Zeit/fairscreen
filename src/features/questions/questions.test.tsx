import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { BrowserServicesProvider } from "../../app/BrowserServicesProvider";
import {
  interviewQuestionId,
  interviewSessionId,
} from "../../domain/factories";
import type {
  InterviewQuestion,
  QuestionGenerationRequest,
} from "../../domain/models";
import { countTemplatesByBank, questionCatalogue } from "./catalogue";
import {
  createFakeQuestionProvider,
  LocalQuestionProvider,
} from "./LocalQuestionProvider";
import { prepareCustomQuestions } from "./customQuestions";
import { extractRoleTerms } from "./extractor";
import { hasNormalizedDuplicate, normalizeQuestionText } from "./normalization";
import { QuestionProviderProvider } from "./QuestionProviderContext";
import { SetupDraftProvider } from "../setup/SetupDraftProvider";
import {
  createDefaultSetupDraft,
  toInterviewContext,
  toInterviewSettings,
} from "../setup/setupDraft";
import { SetupPage } from "../setup/SetupPage";

describe("M05 question catalogue", () => {
  it("contains at least 60 unique built-in IDs and 12 per required bank", () => {
    const ids = new Set(questionCatalogue.map((template) => template.id));

    expect(questionCatalogue).toHaveLength(60);
    expect(ids.size).toBe(60);
    expect(countTemplatesByBank()).toEqual([
      { category: "general-behavioural", count: 12 },
      { category: "software-technical", count: 12 },
      { category: "customer-service", count: 12 },
      { category: "leadership", count: 12 },
      { category: "investigative", count: 12 },
    ]);
    expect(
      questionCatalogue.every(
        (template) =>
          template.tags.length > 0 &&
          template.fallbackText.length > 0 &&
          template.allowedTokens.every((token) =>
            ["jobTitle", "companyClause", "keyword"].includes(token),
          ),
      ),
    ).toBe(true);
  });

  it("detects normalized duplicate prompts", () => {
    expect(
      hasNormalizedDuplicate([
        "Tell me about a time you solved a difficult problem.",
        "tell me about a time you solved a difficult problem!",
      ]),
    ).toBe(true);
  });
});

describe("M05 keyword extraction", () => {
  it("is deterministic, capped, weighted, and filters sensitive-looking tokens", () => {
    const context = toInterviewContext({
      ...createDefaultSetupDraft(),
      jobTitle: "Senior React Analyst",
      jobDescription:
        "React TypeScript privacy testing. Contact sample@example.com or 555-123-4567.",
      resumeText: "Skills: SQL, accessibility, Node.js",
    });

    const first = extractRoleTerms(context);
    const second = extractRoleTerms(context);

    expect(first).toEqual(second);
    expect(first.length).toBeLessThanOrEqual(12);
    expect(first).toContainEqual(
      expect.objectContaining({
        normalized: "react",
        source: "job-title",
      }),
    );
    expect(first.map((keyword) => keyword.normalized)).not.toContain(
      "sample@example.com",
    );
  });

  it("returns a safe default for blank input", () => {
    expect(
      extractRoleTerms({
        ...toInterviewContext({
          ...createDefaultSetupDraft(),
          jobTitle: "Role",
        }),
        jobTitle: "",
      }),
    ).toEqual([
      {
        normalized: "role",
        display: "role",
        source: "job-title",
        weight: 1,
        kind: "role",
      },
    ]);
  });
});

describe("M05 LocalQuestionProvider", () => {
  it("produces deep-equal question order for the same input and seed", async () => {
    const provider = new LocalQuestionProvider();
    const request = createRequest();

    await expect(provider.generate(request)).resolves.toEqual(
      await provider.generate(request),
    );
  });

  it("prevents duplicate normalized questions and uses recovery fallbacks on exhaustion", async () => {
    const provider = new LocalQuestionProvider();
    const exhaustedRequest = {
      ...createRequest(),
      excludedNormalizedQuestions: questionCatalogue.map((template) =>
        normalizeQuestionText(template.fallbackText),
      ),
    };

    const result = await provider.generate(exhaustedRequest);

    expect(
      new Set(result.questions.map((question) => question.normalizedText)).size,
    ).toBe(result.questions.length);
    expect(
      result.questions.some((question) => question.source === "fallback"),
    ).toBe(true);
  });

  it("includes valid custom questions first", async () => {
    const provider = new LocalQuestionProvider();
    const customQuestions = prepareCustomQuestions([
      "What would help you prepare for this team?",
    ]);
    const result = await provider.generate({
      ...createRequest(),
      customQuestions: customQuestions.questions,
    });

    expect(result.questions[0]).toMatchObject({
      source: "custom",
      text: "What would help you prepare for this team?",
      order: 0,
    });
  });
});

describe("M05 custom question editing", () => {
  it("rejects duplicate custom drafts", () => {
    expect(
      prepareCustomQuestions(["What motivates you?", " what motivates you! "])
        .errors,
    ).toEqual([
      {
        index: 1,
        message: "Custom question duplicates question 1.",
      },
    ]);
  });

  it("allows the setup page to use a fake provider without page changes", async () => {
    const user = userEvent.setup();
    const fakeQuestion = createFakeQuestion();
    const provider = createFakeQuestionProvider([fakeQuestion]);

    render(
      <QuestionProviderProvider provider={provider}>
        <SetupDraftProvider
          initialDraft={{
            ...createDefaultSetupDraft(),
            jobTitle: "Research analyst",
          }}
        >
          <BrowserServicesProvider>
            <MemoryRouter>
              <SetupPage />
            </MemoryRouter>
          </BrowserServicesProvider>
        </SetupDraftProvider>
      </QuestionProviderProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: "Generate question set" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Review question set" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Fake provider question?")).toBeInTheDocument();
  });
});

function createRequest(): QuestionGenerationRequest {
  const draft = {
    ...createDefaultSetupDraft(),
    jobTitle: "Frontend analyst",
    jobDescription: "React TypeScript accessibility testing",
    category: "software-technical" as const,
    difficulty: "standard" as const,
  };

  return {
    sessionId: interviewSessionId("session-question-test"),
    context: toInterviewContext(draft),
    settings: toInterviewSettings(draft),
    customQuestions: [],
    excludedNormalizedQuestions: [],
  };
}

function createFakeQuestion(): InterviewQuestion {
  return {
    id: interviewQuestionId("q:fake-provider"),
    source: "fallback",
    text: "Fake provider question?",
    normalizedText: "fake provider question",
    category: "general-behavioural",
    difficulty: "standard",
    tags: ["reflection"],
    renderedKeywords: [],
    order: 0,
    providerId: "fake-question-provider",
    providerVersion: "fake-question-provider-v1",
  };
}
