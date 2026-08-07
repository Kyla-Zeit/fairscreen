import { describe, expect, it } from "vitest";

import {
  interviewQuestionId,
  isoDateTime,
  milliseconds,
} from "../../domain/factories";
import type { InterviewQuestion } from "../../domain/models";
import {
  createManualTranscriptResult,
  createTranscriptRevision,
} from "../transcription/transcription";
import { createDeterministicAnswerAnalyzer } from "./DeterministicAnswerAnalyzer";

const createdAt = isoDateTime("2026-08-01T00:00:00.000Z");

const behaviouralQuestion: InterviewQuestion = {
  id: interviewQuestionId("question:behavioural"),
  source: "built-in",
  text: "Tell me about a time you solved a difficult customer problem.",
  normalizedText:
    "tell me about a time you solved a difficult customer problem",
  category: "customer-service",
  difficulty: "standard",
  tags: ["customer", "problem-solving", "ownership"],
  renderedKeywords: [],
  order: 0,
  providerId: "test-provider",
  providerVersion: "1",
};

const technicalQuestion: InterviewQuestion = {
  ...behaviouralQuestion,
  id: interviewQuestionId("question:technical"),
  text: "How would you design a reliable integration when a dependency fails?",
  normalizedText:
    "how would you design a reliable integration when a dependency fails",
  category: "software-technical",
  tags: ["technical-depth", "trade-off", "testing"],
};

function manualRevision(text: string) {
  const result = createManualTranscriptResult({
    revisionKey: "answer:manual",
    createdAt,
    text,
    locale: "en-CA",
  });
  if (!result.activeRevision) {
    throw new Error("Expected a manual transcript revision.");
  }
  return result.activeRevision;
}

describe("DeterministicAnswerAnalyzer", () => {
  it("returns an insufficient-content result for filler rather than inventing praise", () => {
    const coaching = createDeterministicAnswerAnalyzer().analyzePractice({
      question: behaviouralQuestion,
      transcriptRevision: manualRevision("blah blah blah blah blah"),
      locale: "en-CA",
      answerDurationMs: milliseconds(6_000),
    });

    expect(coaching.status).toBe("insufficient-content");
    expect(coaching.whatWorked).toEqual([]);
    expect(coaching.overallTakeaway).toMatch(/not enough meaningful/i);
  });

  it("produces question-aware technical feedback from a reviewed transcript", () => {
    const coaching = createDeterministicAnswerAnalyzer().analyzePractice({
      question: technicalQuestion,
      transcriptRevision: manualRevision(
        "I designed the integration around a timeout and retry policy. I added idempotent queue handling, a degraded fallback, structured logging, and tests for dependency failure. The result reduced duplicate records by 35 percent and gave support staff a clear recovery path.",
      ),
      locale: "en-CA",
      answerDurationMs: milliseconds(75_000),
      context: {
        jobTitle: "Intermediate Software Developer",
        category: "software-technical",
        difficulty: "standard",
        locale: "en-CA",
        jobDescription:
          "Build reliable integrations and test failure handling.",
      },
    });

    expect(coaching.status).toBe("ready");
    expect(
      coaching.analysis?.categories.some(
        (item) => item.id === "star-structure",
      ),
    ).toBe(true);
    expect(coaching.followUpQuestions).toHaveLength(2);
    expect(coaching.suggestedStrongerAnswer).toContain(
      "idempotent queue handling",
    );
    expect(coaching.suggestedStrongerAnswer).toContain("\n\n");
    expect(coaching.suggestedStrongerAnswer).not.toMatch(
      /A stronger answer could begin/i,
    );
  });

  it("requires review before analysing browser-generated text", () => {
    const revision = createTranscriptRevision({
      revisionKey: "answer:browser",
      createdAt,
      text: "I resolved the issue by testing the failure path and documenting the result.",
      source: "browser-speech",
      reviewedByUser: false,
      locale: "en-CA",
    });

    const coaching = createDeterministicAnswerAnalyzer().analyzePractice({
      question: behaviouralQuestion,
      transcriptRevision: revision,
      locale: "en-CA",
    });

    expect(coaching.status).toBe("transcript-required");
    expect(coaching.analysis).toBeUndefined();
  });

  it("does not invent résumé evidence when no relevant sentence exists", () => {
    const coaching = createDeterministicAnswerAnalyzer().analyzePractice({
      question: technicalQuestion,
      transcriptRevision: manualRevision(
        "I designed a retry policy, tested timeouts, documented the trade-off, and measured the result for the support team.",
      ),
      locale: "en-CA",
      context: {
        jobTitle: "Software Developer",
        category: "software-technical",
        difficulty: "standard",
        locale: "en-CA",
        resumeText:
          "Licensed private investigator. Conducted surveillance and prepared legal reports.",
      },
    });

    expect(coaching.suggestedStrongerAnswer).toMatch(
      /retry policy|tested timeouts|trade-off/i,
    );
    expect(coaching.suggestedStrongerAnswer).not.toMatch(
      /licensed private investigator/i,
    );
  });

  it("keeps transcript details intact instead of cutting words mid-sentence", () => {
    const distinctiveDetail =
      "I would persist the request for later processing and return a clear degraded response to the user.";
    const coaching = createDeterministicAnswerAnalyzer().analyzePractice({
      question: technicalQuestion,
      transcriptRevision: manualRevision(
        `I would define a timeout and bounded retry policy. ${distinctiveDetail} I would test the dependency failure path and monitor recovery metrics.`,
      ),
      locale: "en-CA",
    });

    expect(coaching.suggestedStrongerAnswer).toContain(distinctiveDetail);
    expect(coaching.suggestedStrongerAnswer).not.toMatch(/processing…/);
  });
});

it("builds a stronger customer-service answer without technical assumptions", () => {
  const coaching = createDeterministicAnswerAnalyzer().analyzePractice({
    question: behaviouralQuestion,
    transcriptRevision: manualRevision(
      "A customer called because an urgent order had not arrived. I listened carefully, confirmed what they needed, checked the shipment, and explained the available options. I arranged a replacement, followed up the next morning, and the customer thanked me for keeping them informed.",
    ),
    locale: "en-CA",
    context: {
      jobTitle: "Customer Support Specialist",
      category: "customer-service",
      difficulty: "standard",
      locale: "en-CA",
    },
  });

  expect(coaching.suggestedStrongerAnswer).toMatch(/listened carefully/i);
  expect(coaching.suggestedStrongerAnswer).toMatch(/replacement/i);
  expect(coaching.suggestedStrongerAnswer).toMatch(/customer thanked me/i);
  expect(coaching.suggestedStrongerAnswer).not.toMatch(
    /circuit breaker|idempotent|dependency call/i,
  );
});

it("uses a motivation structure for why-this-role questions", () => {
  const question: InterviewQuestion = {
    ...behaviouralQuestion,
    id: interviewQuestionId("question:motivation"),
    text: "Why do you want this role?",
    normalizedText: "why do you want this role",
    category: "general-behavioural",
    tags: ["motivation"],
  };
  const coaching = createDeterministicAnswerAnalyzer().analyzePractice({
    question,
    transcriptRevision: manualRevision(
      "I am interested in this role because it combines investigation, documentation, and helping people solve difficult problems. In my current work I review evidence, explain findings clearly, and manage sensitive information. I want to bring those skills into a collaborative team while continuing to grow.",
    ),
    locale: "en-CA",
    context: {
      jobTitle: "Support Analyst",
      category: "general-behavioural",
      difficulty: "standard",
      locale: "en-CA",
    },
  });

  expect(coaching.suggestedStrongerAnswer).toMatch(/interested in this role/i);
  expect(coaching.suggestedStrongerAnswer).toMatch(/review evidence/i);
  expect(coaching.suggestedStrongerAnswer).toMatch(/Support Analyst/i);
});

it("removes repeated ideas from the suggested stronger answer", () => {
  const repeated =
    "I listened to the customer, confirmed the issue, and explained the next steps.";
  const coaching = createDeterministicAnswerAnalyzer().analyzePractice({
    question: behaviouralQuestion,
    transcriptRevision: manualRevision(
      `${repeated} ${repeated} I arranged a replacement and followed up. The customer confirmed the problem was resolved.`,
    ),
    locale: "en-CA",
  });

  const occurrences =
    coaching.suggestedStrongerAnswer
      .toLowerCase()
      .split("i listened to the customer").length - 1;
  expect(occurrences).toBe(1);
});

it("creates a direct, concise transferable-experience answer without repeating the original", () => {
  const question: InterviewQuestion = {
    ...behaviouralQuestion,
    id: interviewQuestionId("question:transferable-growth"),
    text: "Which part of your experience is most transferable to Full Stack Developer, and where would you still need to grow?",
    normalizedText:
      "which part of your experience is most transferable to full stack developer and where would you still need to grow",
    category: "general-behavioural",
    tags: ["reflection"],
  };
  const transcript =
    "The most transferable part of my experience is my ability to investigate problems, understand root causes, and carry a solution through from beginning to end. As a private investigator, I regularly work with incomplete information, identify patterns, document findings clearly, and explain technical details to clients. I have also built full-stack applications with React, TypeScript, C#, APIs, and SQL, taking features from requirements through testing. Where I still need to grow is gaining more experience on a larger production team, especially with mature deployment pipelines and long-running systems. I am actively building that experience through larger projects, automated testing, and deployment work.";
  const coaching = createDeterministicAnswerAnalyzer().analyzePractice({
    question,
    transcriptRevision: manualRevision(transcript),
    locale: "en-CA",
    context: {
      jobTitle: "Full Stack Developer",
      category: "general-behavioural",
      difficulty: "standard",
      locale: "en-CA",
    },
  });

  expect(coaching.suggestedStrongerAnswer).toMatch(
    /^The most transferable part of my experience/i,
  );
  expect(coaching.suggestedStrongerAnswer).toMatch(/root causes/i);
  expect(coaching.suggestedStrongerAnswer).toMatch(/still need to grow/i);
  expect(coaching.suggestedStrongerAnswer.split("\n\n")).toHaveLength(3);
  expect(coaching.suggestedStrongerAnswer.length).toBeLessThan(
    transcript.length * 1.1,
  );
  expect(
    coaching.suggestedStrongerAnswer
      .toLowerCase()
      .split("most transferable part").length - 1,
  ).toBe(1);
});

it("keeps both the transferable strength and growth area from a detailed real answer", () => {
  const question: InterviewQuestion = {
    ...behaviouralQuestion,
    id: interviewQuestionId("question:transferable-growth-detailed"),
    text: "Which part of your experience is most transferable to Full Stack Developer, and where would you still need to grow?",
    normalizedText:
      "which part of your experience is most transferable to full stack developer and where would you still need to grow",
    category: "general-behavioural",
    tags: ["reflection"],
  };
  const transcript =
    "The most transferable part of my experience is my ability to investigate problems, understand what went wrong, and carry a solution through from beginning to end. As a private investigator, I regularly work with incomplete information, identify patterns, verify details, document findings, and make sound decisions independently. Earlier in my career, I also worked in technical support and supervised a help desk team, which taught me how to troubleshoot issues, communicate clearly with users, and stay focused on practical outcomes. Those skills transfer directly to full-stack development. In my own projects, I have worked across frontend interfaces, backend logic, APIs, databases, testing, and deployment using React, Angular, TypeScript, C#, ASP.NET Core, and SQL. I enjoy understanding how the whole system fits together, not just working on one isolated layer. The area where I would still need to grow is experience working within a large production engineering environment. Most of my recent development work has been through independent projects, so I would benefit from more exposure to team-based codebases, formal code review, cloud infrastructure, production monitoring, and mature CI/CD processes. That said, I already bring strong troubleshooting skills, professional discipline, self-awareness, and the ability to learn independently. I see working within an established development team as the next step that would help me build on that foundation.";
  const coaching = createDeterministicAnswerAnalyzer().analyzePractice({
    question,
    transcriptRevision: manualRevision(transcript),
    locale: "en-CA",
    context: {
      jobTitle: "Full Stack Developer",
      category: "general-behavioural",
      difficulty: "standard",
      locale: "en-CA",
    },
  });

  expect(coaching.suggestedStrongerAnswer).toMatch(
    /^The most transferable part of my experience/i,
  );
  expect(coaching.suggestedStrongerAnswer).toMatch(/private investigator/i);
  expect(coaching.suggestedStrongerAnswer).toMatch(
    /React|Angular|TypeScript|ASP\.NET Core|SQL/i,
  );
  expect(coaching.suggestedStrongerAnswer).toMatch(
    /large production engineering environment|team-based codebases|code review|cloud infrastructure|production monitoring|CI\/CD/i,
  );
  expect(
    coaching.suggestedStrongerAnswer.split("\n\n").length,
  ).toBeGreaterThanOrEqual(3);
  expect(coaching.suggestedStrongerAnswer.length).toBeLessThan(
    transcript.length,
  );
});
