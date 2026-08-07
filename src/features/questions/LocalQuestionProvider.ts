import {
  interviewQuestionId,
  questionTemplateId,
} from "../../domain/factories";
import type {
  ExtractedKeyword,
  InterviewCategory,
  InterviewDifficulty,
  InterviewQuestion,
  QuestionGenerationRequest,
  QuestionGenerationResult,
  QuestionSelectionReason,
  QuestionSource,
  QuestionTag,
  QuestionTemplate,
} from "../../domain/models";
import type { QuestionProvider } from "../../domain/ports";
import {
  QUESTION_PROVIDER_VERSION,
  questionCatalogue,
  recoveryQuestionTemplates,
} from "./catalogue";
import { extractRoleTerms, KEYWORD_EXTRACTOR_VERSION } from "./extractor";
import { normalizeQuestionText } from "./normalization";

type BuiltInCategory = Exclude<InterviewCategory, "custom-mixed">;

const providerId = "local-question-provider";

export class LocalQuestionProvider implements QuestionProvider {
  readonly providerId = providerId;
  readonly providerVersion = QUESTION_PROVIDER_VERSION;

  generate(
    request: QuestionGenerationRequest,
  ): Promise<QuestionGenerationResult> {
    const extractedKeywords = extractRoleTerms(request.context);
    const selectedQuestions: InterviewQuestion[] = [];
    const selectionReasons: QuestionSelectionReason[] = [];
    const seenNormalized = new Set(request.excludedNormalizedQuestions);

    for (const customQuestion of request.customQuestions) {
      if (selectedQuestions.length >= request.settings.questionCount) {
        break;
      }

      const normalizedText = normalizeQuestionText(customQuestion.text);
      if (!normalizedText || seenNormalized.has(normalizedText)) {
        continue;
      }

      seenNormalized.add(normalizedText);
      const question = createQuestion({
        id: `q:${customQuestion.clientId}`,
        source: "custom",
        text: customQuestion.text.trim(),
        normalizedText,
        category:
          request.context.category === "custom-mixed"
            ? "general-behavioural"
            : request.context.category,
        difficulty: request.context.difficulty,
        tags: ["reflection"],
        order: selectedQuestions.length,
        renderedKeywords: [],
      });
      selectedQuestions.push(question);
      selectionReasons.push({
        questionId: question.id,
        reason: "custom",
        details: ["User-authored custom question."],
      });
    }

    for (const template of selectTemplates(request, extractedKeywords)) {
      if (selectedQuestions.length >= request.settings.questionCount) {
        break;
      }

      const text = renderTemplate(template, request, extractedKeywords);
      const normalizedText = normalizeQuestionText(text);
      if (seenNormalized.has(normalizedText)) {
        continue;
      }

      seenNormalized.add(normalizedText);
      const question = createQuestion({
        id: `q:${template.id.toLowerCase()}`,
        source:
          template.allowedTokens.length > 0 ? "adapted-template" : "built-in",
        templateId: template.id,
        text,
        normalizedText,
        category: template.category,
        difficulty: template.difficulty,
        tags: template.tags,
        order: selectedQuestions.length,
        renderedKeywords: chooseRenderedKeywords(template, extractedKeywords),
      });
      selectedQuestions.push(question);
      selectionReasons.push({
        questionId: question.id,
        reason:
          template.category === request.context.category
            ? template.difficulty === request.context.difficulty
              ? "difficulty-match"
              : "category-match"
            : template.allowedTokens.includes("keyword")
              ? "keyword-adapted"
              : "fallback",
        details: [
          `Template ${template.id}`,
          `Extractor ${KEYWORD_EXTRACTOR_VERSION}`,
        ],
      });
    }

    for (const recoveryText of recoveryQuestionTemplates) {
      if (selectedQuestions.length >= request.settings.questionCount) {
        break;
      }

      const normalizedText = normalizeQuestionText(recoveryText);
      if (seenNormalized.has(normalizedText)) {
        continue;
      }

      seenNormalized.add(normalizedText);
      const question = createQuestion({
        id: `q:recovery-${selectedQuestions.length + 1}`,
        source: "fallback",
        text: recoveryText,
        normalizedText,
        category: "general-behavioural",
        difficulty: request.context.difficulty,
        tags: ["reflection"],
        order: selectedQuestions.length,
        renderedKeywords: [],
      });
      selectedQuestions.push(question);
      selectionReasons.push({
        questionId: question.id,
        reason: "fallback",
        details: ["Role-neutral recovery question."],
      });
    }

    return Promise.resolve({
      questions: selectedQuestions,
      extractedKeywords,
      selectionReasons,
      warnings:
        selectedQuestions.length < request.settings.questionCount
          ? ["Question bank exhausted before reaching the requested count."]
          : [],
      providerId,
      providerVersion: QUESTION_PROVIDER_VERSION,
    });
  }
}

export function createFakeQuestionProvider(
  questions: readonly InterviewQuestion[] = [],
): QuestionProvider {
  return {
    providerId: "fake-question-provider",
    providerVersion: "fake-question-provider-v1",
    generate() {
      return Promise.resolve({
        questions,
        extractedKeywords: [],
        selectionReasons: questions.map((question) => ({
          questionId: question.id,
          reason: "fallback",
          details: ["Fake provider fixture."],
        })),
        warnings: [],
        providerId: "fake-question-provider",
        providerVersion: "fake-question-provider-v1",
      });
    },
  };
}

export async function createRecoveryQuestionResult(
  request: QuestionGenerationRequest,
): Promise<QuestionGenerationResult> {
  return new LocalQuestionProvider().generate({
    ...request,
    context: {
      ...request.context,
      category: "general-behavioural",
      difficulty: request.context.difficulty,
    },
    customQuestions: [],
    excludedNormalizedQuestions: [],
  });
}

function selectTemplates(
  request: QuestionGenerationRequest,
  keywords: readonly ExtractedKeyword[],
): readonly QuestionTemplate[] {
  const selectedCategory =
    request.context.category === "custom-mixed"
      ? undefined
      : request.context.category;
  const seed = createSeed(`${request.sessionId}:${request.context.jobTitle}`);

  const candidateGroups = [
    templatesFor(selectedCategory, [request.context.difficulty]),
    templatesFor(
      selectedCategory,
      adjacentDifficulties(request.context.difficulty),
    ),
    templatesFor("general-behavioural", [
      "foundational",
      "standard",
      "advanced",
    ]),
    questionCatalogue,
  ];

  const ordered: QuestionTemplate[] = [];
  const seen = new Set<string>();

  for (const group of candidateGroups) {
    const scored = group
      .filter((template) => !seen.has(template.id))
      .map((template) => ({
        template,
        score: scoreTemplate(template, request, keywords),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return (
          seededOrder(seed, left.template.id) -
          seededOrder(seed, right.template.id)
        );
      });

    for (const item of scored) {
      seen.add(item.template.id);
      ordered.push(item.template);
    }
  }

  return ordered;
}

function templatesFor(
  category: BuiltInCategory | undefined,
  difficulties: readonly InterviewDifficulty[],
): readonly QuestionTemplate[] {
  return questionCatalogue.filter(
    (template) =>
      (category === undefined || template.category === category) &&
      difficulties.includes(template.difficulty),
  );
}

function adjacentDifficulties(
  difficulty: InterviewDifficulty,
): readonly InterviewDifficulty[] {
  switch (difficulty) {
    case "foundational":
      return ["standard"];
    case "standard":
      return ["foundational", "advanced"];
    case "advanced":
      return ["standard"];
  }
}

function scoreTemplate(
  template: QuestionTemplate,
  request: QuestionGenerationRequest,
  keywords: readonly ExtractedKeyword[],
) {
  const categoryScore = template.category === request.context.category ? 80 : 0;
  const difficultyScore =
    template.difficulty === request.context.difficulty ? 30 : 0;
  const keywordScore =
    template.allowedTokens.includes("keyword") && keywords.length > 0 ? 12 : 0;
  return categoryScore + difficultyScore + keywordScore + template.tags.length;
}

function renderTemplate(
  template: QuestionTemplate,
  request: QuestionGenerationRequest,
  keywords: readonly ExtractedKeyword[],
) {
  const jobTitle = safeToken(request.context.jobTitle) || "this role";
  const company = safeToken(request.context.company ?? "");
  const keyword = safeToken(keywords[0]?.display ?? "") || "the role";
  return template.template
    .replace(/\{jobTitle\}/g, jobTitle)
    .replace(/\{companyClause\}/g, company ? ` at ${company}` : "")
    .replace(/\{keyword\}/g, keyword);
}

function chooseRenderedKeywords(
  template: QuestionTemplate,
  keywords: readonly ExtractedKeyword[],
) {
  return template.allowedTokens.includes("keyword") && keywords[0]
    ? [keywords[0]]
    : [];
}

function safeToken(value: string) {
  const normalized = value.normalize("NFKC").trim();
  if (
    /(?:@|https?:|www\.|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{6,})/i.test(normalized)
  ) {
    return "";
  }

  return normalized.slice(0, 80);
}

function createQuestion(input: {
  readonly id: string;
  readonly source: QuestionSource;
  readonly templateId?: string;
  readonly text: string;
  readonly normalizedText: string;
  readonly category: BuiltInCategory;
  readonly difficulty: InterviewDifficulty;
  readonly tags: readonly QuestionTag[];
  readonly order: number;
  readonly renderedKeywords: readonly ExtractedKeyword[];
}): InterviewQuestion {
  return {
    id: interviewQuestionId(input.id),
    source: input.source,
    ...(input.templateId === undefined
      ? {}
      : { templateId: questionTemplateId(input.templateId) }),
    text: input.text,
    normalizedText: input.normalizedText,
    category: input.category,
    difficulty: input.difficulty,
    tags: input.tags,
    renderedKeywords: input.renderedKeywords,
    order: input.order,
    providerId,
    providerVersion: QUESTION_PROVIDER_VERSION,
  };
}

function createSeed(value: string) {
  let hash = 2166136261;

  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededOrder(seed: number, value: string) {
  let hash = seed;

  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
