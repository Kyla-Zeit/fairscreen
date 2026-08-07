import type { EvidenceSpan } from "../../domain/common";
import type {
  AnalysisCategory,
  AnalysisCategoryId,
  AnalysisRating,
  AnswerAnalysis,
  AnswerAnalysisInput,
  AudioMetrics,
  InterviewContext,
  TranscriptRevision,
} from "../../domain/models";
import type { AnswerAnalyzer } from "../../domain/ports";

export interface PracticeAnalysisInput extends AnswerAnalysisInput {
  readonly context?: InterviewContext;
  readonly audioMetrics?: AudioMetrics;
}

export interface PracticeCoaching {
  readonly status: "ready" | "insufficient-content" | "transcript-required";
  readonly overallTakeaway: string;
  readonly answerSummary: string;
  readonly whatWorked: readonly string[];
  readonly whatToImprove: readonly string[];
  readonly suggestedStrongerAnswer: string;
  readonly followUpQuestions: readonly string[];
  readonly tryThisNext: string;
  readonly deliveryObservations: readonly string[];
  readonly analysis?: AnswerAnalysis;
}

export interface PracticeAnswerAnalyzer extends AnswerAnalyzer {
  analyzePractice(input: PracticeAnalysisInput): PracticeCoaching;
}

const VERSION = "m11.7-deterministic-coaching-v2";
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "our",
  "so",
  "that",
  "the",
  "their",
  "then",
  "there",
  "this",
  "to",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "you",
  "your",
]);
const FILLER_PATTERN =
  /\b(?:um+|uh+|like|basically|actually|you know|sort of|kind of)\b/gi;
const ACTION_PATTERN =
  /\b(?:I|we)\s+(?:built|created|designed|implemented|investigated|led|resolved|tested|documented|changed|proposed|configured|analysed|analyzed|debugged|improved|coordinated|delivered)\b/gi;
const OUTCOME_PATTERN =
  /\b(?:result|outcome|impact|improved|reduced|increased|saved|resolved|completed|delivered|prevented|measured|percent|%)\b/gi;
const SITUATION_PATTERN =
  /\b(?:situation|context|when|while|during|at the time|the problem|the issue)\b/gi;
const TASK_PATTERN =
  /\b(?:task|goal|responsible|needed to|had to|objective|priority)\b/gi;
const TECHNICAL_PATTERN =
  /\b(?:trade-?off|failure|fallback|retry|timeout|security|privacy|test|monitor|logging|idempot|queue|performance|accessibility|user impact)\b/gi;
const NONSENSE_PATTERN =
  /^(?:(?:blah|test|hello|nothing|n\/a|na|asdf|word)\s*)+$/i;

export function createDeterministicAnswerAnalyzer(): PracticeAnswerAnalyzer {
  return {
    analyzerId: "fairscreen-deterministic-answer-analyzer",
    heuristicVersion: VERSION,
    analyze: (input) => analyzeAnswer(input),
    analyzePractice: (input) => analyzePractice(input),
  };
}

function analyzePractice(input: PracticeAnalysisInput): PracticeCoaching {
  const transcript = input.transcriptRevision;
  if (!transcript.reviewedByUser) {
    return {
      status: "transcript-required",
      overallTakeaway: "Review the transcript before content coaching.",
      answerSummary:
        "FairScreen does not analyse unreviewed browser-generated text.",
      whatWorked: [],
      whatToImprove: [
        "Correct any recognition errors, then mark the transcript as reviewed.",
      ],
      suggestedStrongerAnswer:
        "A stronger answer can be suggested after the transcript is reviewed.",
      followUpQuestions: [],
      tryThisNext: "Review and confirm the transcript.",
      deliveryObservations: deliveryObservations(input),
    };
  }

  const text = transcript.text.trim();
  const words = tokens(text);
  const meaningful = words.filter((word) => !STOP_WORDS.has(word));
  const uniqueMeaningful = new Set(meaningful);
  const fillerCount = matches(text, FILLER_PATTERN).length;
  const insufficient =
    words.length < 18 ||
    meaningful.length < 8 ||
    NONSENSE_PATTERN.test(text) ||
    (meaningful.length > 0 &&
      uniqueMeaningful.size / meaningful.length < 0.35) ||
    fillerCount / Math.max(words.length, 1) > 0.35;

  if (insufficient) {
    return {
      status: "insufficient-content",
      overallTakeaway: "Not enough meaningful answer content to assess.",
      answerSummary:
        "The transcript is too short, repetitive, or nonsubstantive for reliable question-aware coaching.",
      whatWorked: [],
      whatToImprove: [
        "Answer the question directly with one real example.",
        structureSuggestion(input),
        "Explain what you personally did and what changed as a result.",
      ],
      suggestedStrongerAnswer: strongerAnswerTemplate(input, undefined),
      followUpQuestions: followUps(input, false, false),
      tryThisNext:
        "Try again with a 30–120 second answer using a specific situation, action, and result.",
      deliveryObservations: deliveryObservations(input),
    };
  }

  const analysis = analyzeAnswer(input);
  const strengths = analysis.detectedStrengths.slice(0, 4);
  const improvements = analysis.suggestedImprovements.slice(0, 5);
  const hasAction = ACTION_PATTERN.test(text);
  const hasOutcome = OUTCOME_PATTERN.test(text);

  return {
    status: "ready",
    overallTakeaway: analysis.summary,
    answerSummary: summarizeTranscript(text),
    whatWorked:
      strengths.length > 0
        ? strengths
        : ["The answer contains enough substance for structured review."],
    whatToImprove:
      improvements.length > 0
        ? improvements
        : [
            "Tighten the answer around the question and finish with the impact.",
          ],
    suggestedStrongerAnswer: strongerAnswerTemplate(input, transcript),
    followUpQuestions: followUps(input, hasAction, hasOutcome),
    tryThisNext:
      improvements[0] ??
      "Repeat the answer once, keeping the same evidence but making the result more explicit.",
    deliveryObservations: deliveryObservations(input),
    analysis,
  };
}

function analyzeAnswer(input: AnswerAnalysisInput): AnswerAnalysis {
  const text = input.transcriptRevision.text.trim();
  const wordList = tokens(text);
  const questionTokens = significantTokens(input.question.text);
  const answerTokens = new Set(significantTokens(text));
  const overlap = questionTokens.filter((word) => answerTokens.has(word));
  const relevanceRatio =
    questionTokens.length === 0 ? 0 : overlap.length / questionTokens.length;
  const actionEvidence = evidence(text, ACTION_PATTERN, "action-cue");
  const outcomeEvidence = evidence(text, OUTCOME_PATTERN, "outcome-cue");
  const situationEvidence = evidence(text, SITUATION_PATTERN, "structure-cue");
  const taskEvidence = evidence(text, TASK_PATTERN, "structure-cue");
  const fillerEvidence = evidence(text, FILLER_PATTERN, "filler");
  const measurementEvidence = evidence(
    text,
    /\b(?:\d+(?:\.\d+)?%?|\$\d+(?:[.,]\d+)?|\d+\s+(?:hours?|days?|weeks?|users?|cases?|tickets?|records?))\b/gi,
    "measurement",
  );
  const technicalEvidence = evidence(text, TECHNICAL_PATTERN, "keyword");
  const isBehavioural = input.question.tags.some((tag) =>
    [
      "conflict",
      "adaptability",
      "leadership",
      "ownership",
      "problem-solving",
      "customer",
      "investigation",
    ].includes(tag),
  );
  const isTechnical = input.question.category === "software-technical";
  const starCount = [
    situationEvidence.length > 0,
    taskEvidence.length > 0,
    actionEvidence.length > 0,
    outcomeEvidence.length > 0,
  ].filter(Boolean).length;
  const categories: AnalysisCategory[] = [
    category(
      "question-relevance",
      "Question relevance",
      relevanceRatio >= 0.28
        ? "strong"
        : relevanceRatio >= 0.12
          ? "developing"
          : "needsMoreEvidence",
      relevanceRatio >= 0.28
        ? "The answer uses several concepts from the question."
        : "The connection to the exact question could be clearer.",
      relevanceRatio >= 0.28
        ? undefined
        : "Open by answering the question in one direct sentence.",
      overlap.map((word) => firstTokenEvidence(text, word)).filter(isEvidence),
      {
        overlapCount: overlap.length,
        questionTokenCount: questionTokens.length,
      },
    ),
    category(
      "specificity",
      "Specificity",
      measurementEvidence.length > 0 || actionEvidence.length >= 2
        ? "strong"
        : actionEvidence.length > 0
          ? "developing"
          : "needsMoreEvidence",
      measurementEvidence.length > 0
        ? "The answer includes concrete evidence or a measurable detail."
        : "The answer would benefit from more concrete detail.",
      measurementEvidence.length > 0
        ? undefined
        : "Name the system, constraint, scale, or observable result.",
      [...measurementEvidence, ...actionEvidence].slice(0, 5),
      { measurementCount: measurementEvidence.length },
    ),
    category(
      "personal-contribution",
      "Personal contribution",
      actionEvidence.length >= 2
        ? "strong"
        : actionEvidence.length === 1
          ? "developing"
          : "needsMoreEvidence",
      actionEvidence.length > 0
        ? "The transcript identifies at least one action you took."
        : "Your own contribution is not yet clear.",
      actionEvidence.length > 0
        ? undefined
        : "Use first-person action language: what you decided, built, changed, or verified.",
      actionEvidence,
      { actionCueCount: actionEvidence.length },
    ),
    category(
      "result-or-outcome",
      "Result or outcome",
      outcomeEvidence.length > 0 ? "strong" : "needsMoreEvidence",
      outcomeEvidence.length > 0
        ? "The answer includes an outcome cue."
        : "The answer does not clearly finish with what changed.",
      outcomeEvidence.length > 0
        ? undefined
        : "End with the result, lesson, or user impact.",
      outcomeEvidence,
      { outcomeCueCount: outcomeEvidence.length },
    ),
    category(
      "measurable-evidence",
      "Measurable evidence",
      measurementEvidence.length > 0 ? "strong" : "developing",
      measurementEvidence.length > 0
        ? "A measurable detail supports the answer."
        : "No measurable evidence was detected; qualitative evidence may still be valid.",
      measurementEvidence.length > 0
        ? undefined
        : "Add a truthful number only when you genuinely know it.",
      measurementEvidence,
      { measurementCount: measurementEvidence.length },
    ),
    category(
      "star-structure",
      isTechnical ? "Technical reasoning structure" : "STAR structure",
      isTechnical
        ? technicalEvidence.length >= 3
          ? "strong"
          : technicalEvidence.length > 0
            ? "developing"
            : "needsMoreEvidence"
        : isBehavioural
          ? starCount >= 3
            ? "strong"
            : starCount === 2
              ? "developing"
              : "needsMoreEvidence"
          : "notApplicable",
      isTechnical
        ? technicalEvidence.length > 0
          ? "The answer includes some implementation or reliability reasoning."
          : "The technical reasoning needs clearer constraints, trade-offs, and verification."
        : isBehavioural
          ? `Detected ${starCount} of 4 common STAR elements.`
          : "STAR structure is not required for this question.",
      isTechnical
        ? "Explain the design, failure handling, trade-offs, testing, and user impact."
        : isBehavioural
          ? "Make the situation, your action, and the result easy to distinguish."
          : undefined,
      isTechnical
        ? technicalEvidence
        : [
            ...situationEvidence,
            ...taskEvidence,
            ...actionEvidence,
            ...outcomeEvidence,
          ],
      {
        starElementCount: starCount,
        technicalCueCount: technicalEvidence.length,
      },
    ),
    category(
      "filler-language",
      "Filler language",
      fillerEvidence.length === 0
        ? "strong"
        : fillerEvidence.length <= 3
          ? "developing"
          : "needsMoreEvidence",
      fillerEvidence.length === 0
        ? "No common filler phrases were detected in the reviewed transcript."
        : `${fillerEvidence.length} possible filler phrase${fillerEvidence.length === 1 ? " was" : "s were"} detected.`,
      fillerEvidence.length === 0
        ? undefined
        : "Pause silently instead of filling the gap.",
      fillerEvidence,
      { fillerCount: fillerEvidence.length },
    ),
    category(
      "length",
      "Answer length",
      wordList.length >= 45 && wordList.length <= 280
        ? "strong"
        : wordList.length >= 20
          ? "developing"
          : "needsMoreEvidence",
      `The reviewed transcript contains ${wordList.length} words.`,
      wordList.length < 45
        ? "Add enough detail to show your reasoning and result."
        : wordList.length > 280
          ? "Remove background details that do not change the answer."
          : undefined,
      [],
      { wordCount: wordList.length },
    ),
    category(
      "clarity-and-concision",
      "Clarity and concision",
      averageSentenceLength(text) <= 28 ? "strong" : "developing",
      averageSentenceLength(text) <= 28
        ? "Sentence length is generally workable."
        : "Several ideas may be packed into long sentences.",
      averageSentenceLength(text) <= 28
        ? undefined
        : "Use shorter sentences and one idea per step.",
      [],
      { averageSentenceWords: averageSentenceLength(text) },
    ),
  ];

  const strengths = categories
    .filter((item) => item.rating === "strong")
    .map((item) => item.summary);
  const improvements = categories
    .filter((item) => item.rating === "needsMoreEvidence")
    .map((item) => item.suggestion ?? item.summary);

  return {
    analyzerId: "fairscreen-deterministic-answer-analyzer",
    heuristicVersion: VERSION,
    analyzedAt: input.transcriptRevision.createdAt,
    transcriptRevisionId: input.transcriptRevision.id,
    transcriptDigest: input.transcriptRevision.normalizedDigest,
    locale: input.locale,
    categories,
    detectedStrengths: strengths,
    suggestedImprovements: improvements,
    summary:
      improvements.length === 0
        ? "The answer is substantive and well structured. Refine it once more for concision."
        : strengths.length > 0
          ? `The answer has useful evidence, with ${improvements.length} clear improvement area${improvements.length === 1 ? "" : "s"}.`
          : "The answer is assessable, but it needs a more direct structure and stronger evidence.",
    limitations: [
      "This is deterministic practice feedback, not an employer assessment.",
      "The analyzer uses reviewed transcript text and question context only; video observations do not affect content feedback.",
      "Heuristics may miss valid phrasing and should be treated as revision prompts, not facts about the speaker.",
    ],
  };
}

function category(
  id: AnalysisCategoryId,
  label: string,
  rating: AnalysisRating,
  summary: string,
  suggestion: string | undefined,
  itemEvidence: readonly EvidenceSpan[],
  details: Readonly<Record<string, string | number | boolean | null>>,
): AnalysisCategory {
  return {
    id,
    label,
    rating,
    summary,
    ...(suggestion ? { suggestion } : {}),
    evidence: itemEvidence,
    ruleId: `m10-${id}`,
    ruleVersion: VERSION,
    details,
    limitations: [],
  };
}

function structureSuggestion(input: PracticeAnalysisInput): string {
  return input.question.category === "software-technical"
    ? "Explain the dependency or constraint, your design, failure handling, trade-offs, testing, and user impact."
    : "Use a simple STAR structure: situation, task, your action, and the result.";
}

type AnswerIntent =
  | "introduction"
  | "motivation"
  | "strength-or-growth"
  | "behavioural"
  | "situational"
  | "technical"
  | "general";

function strongerAnswerTemplate(
  input: PracticeAnalysisInput,
  transcript: TranscriptRevision | undefined,
): string {
  if (!transcript?.text.trim()) {
    return missingContentAnswer(input);
  }

  const cleanedSentences = selectDistinctIdeas(
    answerSentences(transcript.text).map(cleanAnswerSentence).filter(Boolean),
    12,
  );
  if (cleanedSentences.length === 0) {
    return missingContentAnswer(input);
  }

  const intent = classifyAnswerIntent(input);
  if (
    intent === "technical" &&
    isDependencyReliabilityQuestion(input.question.text)
  ) {
    return buildDependencyReliabilityAnswer(
      cleanedSentences.join(" "),
      cleanedSentences,
    );
  }

  switch (intent) {
    case "introduction":
      return buildIntroductionAnswer(input, cleanedSentences);
    case "motivation":
      return buildMotivationAnswer(input, cleanedSentences);
    case "strength-or-growth":
      return buildStrengthOrGrowthAnswer(input, cleanedSentences);
    case "behavioural":
      return buildBehaviouralAnswer(input, cleanedSentences);
    case "situational":
      return buildSituationalAnswer(input, cleanedSentences);
    case "technical":
      return strongerTechnicalAnswer(input, cleanedSentences);
    case "general":
      return buildGeneralAnswer(input, cleanedSentences);
  }
}

function classifyAnswerIntent(input: PracticeAnalysisInput): AnswerIntent {
  const question = input.question.text.toLowerCase();
  const tags = new Set(input.question.tags);

  if (
    /tell me about yourself|walk me through your (?:background|experience)|introduce yourself/.test(
      question,
    ) ||
    tags.has("introduction")
  ) {
    return "introduction";
  }
  if (
    /why (?:do you|would you) want|why (?:this|our) (?:role|job|company)|what interests you|what attracted you|why should we hire/.test(
      question,
    ) ||
    tags.has("motivation")
  ) {
    return "motivation";
  }
  if (
    /(?:greatest|top|key) strength|weakness|area (?:to|for) (?:grow|improve)|need to grow|most transferable|what do you bring/.test(
      question,
    ) ||
    tags.has("reflection")
  ) {
    return "strength-or-growth";
  }
  if (input.question.category === "software-technical") {
    return "technical";
  }
  if (
    /how would you|what would you do|how do you handle|suppose|imagine|if a |if an /.test(
      question,
    )
  ) {
    return "situational";
  }
  if (
    /tell me about a time|describe a time|give (?:me )?an example|when have you|what happened when/.test(
      question,
    ) ||
    [
      "conflict",
      "adaptability",
      "leadership",
      "ownership",
      "problem-solving",
      "customer",
      "investigation",
    ].some((tag) => tags.has(tag as never))
  ) {
    return "behavioural";
  }
  return "general";
}

function missingContentAnswer(input: PracticeAnalysisInput): string {
  const intent = classifyAnswerIntent(input);
  switch (intent) {
    case "technical":
      return [
        directOpening(input.question.text),
        "Explain the requirements, the approach you would take, the important trade-offs, how you would verify it, and the effect on users or the business.",
      ].join("\n\n");
    case "behavioural":
      return [
        "Choose one real example that directly answers the question.",
        "Briefly explain the situation and your responsibility, then focus on what you personally did and the result or lesson.",
      ].join("\n\n");
    case "situational":
      return [
        "State the first action you would take and why.",
        "Then explain the practical steps, how you would communicate, and how you would know the situation was resolved.",
      ].join("\n\n");
    default:
      return [
        directOpening(input.question.text),
        "Support the answer with one specific example, result, or reason that is relevant to the role.",
      ].join("\n\n");
  }
}

function strongerTechnicalAnswer(
  input: PracticeAnalysisInput,
  sentences: readonly string[],
): string {
  const questionTokens = new Set(significantTokens(input.question.text));
  const ranked = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score:
        overlapScore(sentence, questionTokens) * 3 +
        (containsPattern(sentence, TECHNICAL_PATTERN) ? 4 : 0) +
        (containsPattern(sentence, ACTION_PATTERN) ? 3 : 0) +
        (containsPattern(sentence, OUTCOME_PATTERN) ? 4 : 0),
    }))
    .sort(
      (left, right) => right.score - left.score || left.index - right.index,
    );

  const selected = selectDistinctIdeas(
    ranked.map(({ sentence }) => sentence),
    7,
  );
  const validation = selected.filter((sentence) =>
    /\b(?:test|monitor|log|metric|alert|result|impact|measure|production|user|customer|verify|validated?)\b/i.test(
      sentence,
    ),
  );
  const design = selected.filter((sentence) => !validation.includes(sentence));
  const paragraphs: string[] = [];

  if (design.length > 0) {
    paragraphs.push(design.slice(0, 3).join(" "));
  } else {
    paragraphs.push(directTechnicalAnswerOpening(input.question.text));
  }
  if (validation.length > 0) {
    paragraphs.push(validation.slice(0, 3).join(" "));
  } else {
    paragraphs.push(technicalValidationPrompt(input.question.text));
  }

  return composeUniqueParagraphs(paragraphs);
}

function isDependencyReliabilityQuestion(question: string): boolean {
  return (
    /\b(?:dependency|provider|service|integration|api)\b/i.test(question) &&
    /\b(?:fail|failure|unavailable|reliable|resilien|outage|slow)\b/i.test(
      question,
    )
  );
}

function buildDependencyReliabilityAnswer(
  sourceText: string,
  userSentences: readonly string[],
): string {
  const fallbackOptions: string[] = [];
  if (/\bcach(?:e|ed|ing)\b/i.test(sourceText)) {
    fallbackOptions.push("returning recently cached data");
  }
  if (
    /\b(?:secondary|backup|alternate)\s+(?:provider|service|dependency)\b/i.test(
      sourceText,
    )
  ) {
    fallbackOptions.push("switching to a secondary provider");
  }
  if (
    /\b(?:queue|queued|later processing|defer|deferred)\b/i.test(sourceText)
  ) {
    fallbackOptions.push("queuing the request for later processing");
  }
  if (
    /\b(?:degrad|limited functionality|continue without)\b/i.test(sourceText)
  ) {
    fallbackOptions.push("offering a clearly labelled degraded mode");
  }
  if (fallbackOptions.length === 0) {
    fallbackOptions.push(
      "returning safe cached data",
      "queuing recoverable work for later",
      "offering a clearly labelled degraded mode",
    );
  }

  const directUserPoint = userSentences.find((sentence) =>
    /\b(?:I would|I’d|my approach|first|begin|design)\b/i.test(sentence),
  );
  const opening =
    directUserPoint ??
    "I would design the feature on the assumption that the dependency can become slow or unavailable, then define the safe failure behaviour before choosing the implementation.";
  const fallbackSentence = `Depending on the business requirements, the fallback could include ${joinNaturalList(fallbackOptions.slice(0, 3))}.`;
  const idempotencySentence = /\bidempot/i.test(sourceText)
    ? "I would keep retryable operations idempotent so recovery cannot create duplicate records or actions."
    : "Any operation that may be retried or queued would be idempotent so recovery cannot create duplicate records or actions.";

  const userValidation = selectDistinctIdeas(
    userSentences.filter((sentence) =>
      /\b(?:test|monitor|log|metric|alert|recover|result|impact|user|customer|data|timeout|retry|circuit|fallback)\b/i.test(
        sentence,
      ),
    ),
    3,
  );

  const paragraphs = [
    opening,
    `I would use a strict timeout, limited retries with backoff for safe transient failures, and a circuit breaker for sustained outages. ${fallbackSentence} ${idempotencySentence}`,
    userValidation.length > 0
      ? userValidation.join(" ")
      : "I would verify timeouts, partial failures, malformed responses, recovery after an outage, and concurrent retries, then monitor latency, error rate, fallback use, and user impact.",
    "The goal is predictable failure: preserve user data, communicate the degraded state clearly, and recover automatically without duplicate work or manual cleanup.",
  ];

  return composeUniqueParagraphs(paragraphs);
}

function directTechnicalAnswerOpening(question: string): string {
  const subject = question
    .replace(/^(?:design|describe|explain|outline)\s+/i, "")
    .replace(/[?.!]+$/g, "")
    .trim();
  if (!subject) {
    return "I would begin by defining the requirements, failure modes, and user impact before choosing the implementation.";
  }
  return `I would approach ${subject[0]?.toLowerCase() ?? ""}${subject.slice(1)} by defining the constraints and expected failure behaviour first.`;
}

function joinNaturalList(items: readonly string[]): string {
  if (items.length === 0) return "a safe degraded response";
  if (items.length === 1) return items[0] ?? "a safe degraded response";
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, or ${items.at(-1)}`;
}

function selectDistinctIdeas(
  candidates: readonly string[],
  maximum: number,
): string[] {
  const selected: string[] = [];
  for (const candidate of candidates) {
    if (
      selected.some((existing) => ideaSimilarity(existing, candidate) >= 0.62)
    ) {
      continue;
    }
    selected.push(candidate);
    if (selected.length >= maximum) break;
  }
  return selected;
}

function composeUniqueParagraphs(paragraphs: readonly string[]): string {
  const usedSentences: string[] = [];
  const output: string[] = [];

  for (const paragraph of paragraphs) {
    const unique = answerSentences(paragraph)
      .map(cleanAnswerSentence)
      .filter(Boolean)
      .filter((sentence) => {
        const duplicate = usedSentences.some(
          (existing) => ideaSimilarity(existing, sentence) >= 0.48,
        );
        if (!duplicate) usedSentences.push(sentence);
        return !duplicate;
      });
    if (unique.length > 0) output.push(unique.join(" "));
  }

  return output.join("\n\n");
}

function ideaSimilarity(left: string, right: string): number {
  const leftTokens = new Set(significantTokens(left));
  const rightTokens = new Set(significantTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const jaccard = intersection / union;
  const containment =
    intersection / Math.min(leftTokens.size, rightTokens.size);
  return Math.max(jaccard, containment * 0.9);
}

function buildIntroductionAnswer(
  input: PracticeAnalysisInput,
  sentences: readonly string[],
): string {
  const current = selectDistinctIdeas(
    sentences.filter((sentence) =>
      /\b(?:currently|now|my role|I work|I am|I’m|experience|background)\b/i.test(
        sentence,
      ),
    ),
    2,
  );
  const evidence = selectDistinctIdeas(
    sentences.filter(
      (sentence) =>
        !current.includes(sentence) &&
        (containsPattern(sentence, ACTION_PATTERN) ||
          /\b(?:responsible|speciali[sz]e|skilled|strength|known for|focus|built|created|managed|investigated|supported|developed)\b/i.test(
            sentence,
          )),
    ),
    3,
  );
  const future = selectDistinctIdeas(
    sentences.filter(
      (sentence) =>
        !current.includes(sentence) &&
        !evidence.includes(sentence) &&
        /\b(?:looking|seeking|interested|next|grow|opportunity|role|position)\b/i.test(
          sentence,
        ),
    ),
    2,
  );

  return composeUniqueParagraphs([
    current.join(" ") || sentences[0] || "",
    evidence.join(" "),
    future.join(" ") || relevanceClosing(input),
  ]);
}

function buildMotivationAnswer(
  input: PracticeAnalysisInput,
  sentences: readonly string[],
): string {
  const reasons = selectDistinctIdeas(
    sentences.filter((sentence) =>
      /\b(?:because|interested|attracted|appeal|value|mission|product|service|company|role|opportunity|enjoy)\b/i.test(
        sentence,
      ),
    ),
    3,
  );
  const evidence = selectDistinctIdeas(
    sentences.filter(
      (sentence) =>
        !reasons.includes(sentence) &&
        (containsPattern(sentence, ACTION_PATTERN) ||
          /\b(?:experience|background|skill|strength|learned|worked|supported|managed|investigated|developed|reviewed?|evidence|documented|explained)\b/i.test(
            sentence,
          )),
    ),
    3,
  );
  const future = selectDistinctIdeas(
    sentences.filter(
      (sentence) =>
        !reasons.includes(sentence) &&
        !evidence.includes(sentence) &&
        /\b(?:contribute|grow|learn|future|next|bring|develop)\b/i.test(
          sentence,
        ),
    ),
    2,
  );

  return composeUniqueParagraphs([
    reasons.join(" ") || sentences[0] || "",
    evidence.join(" "),
    [future.join(" "), relevanceClosing(input)].filter(Boolean).join(" "),
  ]);
}

function buildStrengthOrGrowthAnswer(
  input: PracticeAnalysisInput,
  sentences: readonly string[],
): string {
  const question = input.question.text.toLowerCase();
  const asksTransferable = /transferable|what do you bring|most relevant/.test(
    question,
  );
  const asksGrowth = /grow|growth|improve|weakness|develop|learn/.test(
    question,
  );

  const growth = selectDistinctIdeas(sentences.filter(isGrowthAreaSentence), 4);
  const strength = selectDistinctIdeas(
    sentences.filter(
      (sentence) =>
        !growth.includes(sentence) &&
        /\b(?:strength|strong|best|transferable|skilled|good at|experience|background|problem.solving|communicat|investigat|document|support|lead|manage|build|develop)\b/i.test(
          sentence,
        ),
    ),
    2,
  );
  const evidence = selectDistinctIdeas(
    sentences.filter(
      (sentence) =>
        !strength.includes(sentence) &&
        !growth.includes(sentence) &&
        (containsPattern(sentence, ACTION_PATTERN) ||
          containsPattern(sentence, OUTCOME_PATTERN) ||
          /\b(?:for example|in my work|in my role|I have|I’ve|I also|that means)\b/i.test(
            sentence,
          )),
    ),
    3,
  );

  if (asksTransferable && asksGrowth) {
    return buildTransferableGrowthAnswer({
      input,
      sentences,
      strength,
      evidence,
      growth,
    });
  }

  const openingSource = strength[0] ?? sentences[0] ?? "";
  const opening = asksTransferable
    ? makeTransferableOpening(openingSource)
    : openingSource;
  const development =
    growth.length > 0
      ? growth.join(" ")
      : asksGrowth
        ? "I would answer the growth part directly with one honest skill gap and the specific steps I am taking to close it."
        : "";

  return composeUniqueParagraphs([
    [opening, strength[1]].filter(Boolean).join(" "),
    evidence.join(" "),
    development,
  ]);
}

interface TransferableGrowthParts {
  readonly input: PracticeAnalysisInput;
  readonly sentences: readonly string[];
  readonly strength: readonly string[];
  readonly evidence: readonly string[];
  readonly growth: readonly string[];
}

function buildTransferableGrowthAnswer({
  input,
  sentences,
  strength,
  evidence,
  growth,
}: TransferableGrowthParts): string {
  const openingSource =
    sentences.find((sentence) =>
      /most transferable|transferable part/i.test(sentence),
    ) ??
    strength[0] ??
    sentences[0] ??
    "";
  const supportingStrength =
    sentences.find(
      (sentence) =>
        sentence !== openingSource &&
        /\b(?:private investigator|investigat|technical support|customer support|help desk|administrat|manage|lead|document|analyse|analyze|customer|client)\b/i.test(
          sentence,
        ),
    ) ?? strength.find((sentence) => sentence !== openingSource);
  const evidenceSource =
    selectBestRoleEvidence(
      input,
      sentences.filter(
        (sentence) =>
          sentence !== openingSource &&
          sentence !== supportingStrength &&
          !isGrowthAreaSentence(sentence),
      ),
    ) ?? evidence[0];
  const secondaryEvidence = sentences.find(
    (sentence) =>
      sentence !== openingSource &&
      sentence !== supportingStrength &&
      sentence !== evidenceSource &&
      !isGrowthAreaSentence(sentence) &&
      /\b(?:technical support|help desk|communicat|troubleshoot|supervis|lead|customer|client)\b/i.test(
        sentence,
      ),
  );
  const growthSource =
    growth.find((sentence) =>
      /area where|still need|need to grow|less experience|limited experience/i.test(
        sentence,
      ),
    ) ??
    growth[0] ??
    sentences.find(isGrowthAreaSentence);
  const growthDetail =
    growth.find((sentence) => sentence !== growthSource) ??
    sentences.find(
      (sentence) =>
        sentence !== growthSource &&
        /\b(?:more exposure|team-based|code review|cloud|production monitoring|CI\/?CD|established team|larger team|mature process|building that experience|actively)\b/i.test(
          sentence,
        ),
    );

  const opening = polishTransferableOpening(openingSource);
  const support = supportingStrength
    ? polishSupportingExperience(supportingStrength)
    : "";
  const evidenceParagraph = [
    evidenceSource ? polishAppliedEvidence(evidenceSource) : "",
    secondaryEvidence ? polishSupportingExperience(secondaryEvidence) : "",
  ]
    .filter(Boolean)
    .join(" ");
  const growthOpening = growthSource
    ? polishGrowthOpening(growthSource)
    : "The area where I still need to grow is gaining more experience in the parts of the role I have not yet handled in a larger production environment.";
  const growthParagraph = [growthOpening, growthDetail]
    .filter(Boolean)
    .join(" ");

  return composeUniqueParagraphs([
    [opening, support].filter(Boolean).join(" "),
    evidenceParagraph,
    growthParagraph,
  ]);
}

function isGrowthAreaSentence(sentence: string): boolean {
  return /(?:\b(?:still|would) need to grow\b|\barea (?:where|in which).*\bgrow\b|\bneed (?:more )?experience\b|\bless experience\b|\blimited experience\b|\bwould benefit from more exposure\b|\bneed to improve\b|\bwant to improve\b|\bworking on improving\b|\bcontinue to learn\b|\blearn more about\b|\bbuilding that experience\b|\bweakness\b)/i.test(
    sentence,
  );
}

function selectBestRoleEvidence(
  input: PracticeAnalysisInput,
  sentences: readonly string[],
): string | undefined {
  const roleTokens = new Set(
    significantTokens(
      `${input.context?.jobTitle ?? ""} ${input.question.text}`,
    ),
  );
  return sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score:
        overlapScore(sentence, roleTokens) * 4 +
        (/\b(?:project|application|frontend|backend|api|database|testing|deployment|workflow|report|investigation|customer|support|leadership|administration)\b/i.test(
          sentence,
        )
          ? 5
          : 0) +
        (/\b(?:React|Angular|TypeScript|JavaScript|C#|ASP\.NET|SQL|Python|Java|Node|Excel|Salesforce|case management|surveillance|evidence)\b/i.test(
          sentence,
        )
          ? 6
          : 0) +
        (containsPattern(sentence, ACTION_PATTERN) ? 2 : 0),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .find(({ score }) => score > 0)?.sentence;
}

function polishTransferableOpening(sentence: string): string {
  const cleaned = cleanAnswerSentence(sentence);
  const direct = cleaned
    .replace(
      /^(?:I (?:think|believe|would say) (?:that )?)?the most transferable part of my experience is /i,
      "",
    )
    .replace(/^my most transferable experience is /i, "")
    .trim();
  if (!direct) return makeTransferableOpening(cleaned);
  return `The most transferable part of my experience is ${lowercaseFirst(direct)}`;
}

function polishSupportingExperience(sentence: string): string {
  return cleanAnswerSentence(sentence)
    .replace(/^As a ([^,]+), I /i, "In my work as a $1, I ")
    .replace(/^In my role as a ([^,]+), I /i, "In my work as a $1, I ");
}

function polishAppliedEvidence(sentence: string): string {
  const cleaned = cleanAnswerSentence(sentence);
  if (/^I have also built full-stack applications with /i.test(cleaned)) {
    return cleaned.replace(
      /^I have also built full-stack applications with /i,
      "I have applied those skills in full-stack projects using ",
    );
  }
  if (/^I have also built /i.test(cleaned)) {
    return cleaned.replace(
      /^I have also built /i,
      "I have applied those skills by building ",
    );
  }
  if (/^I also /i.test(cleaned)) {
    return cleaned.replace(/^I also /i, "I have applied those skills by ");
  }
  return cleaned;
}

function polishGrowthOpening(sentence: string): string {
  const cleaned = cleanAnswerSentence(sentence);
  return cleaned
    .replace(
      /^Where I still need to grow is /i,
      "The area where I still need to grow is ",
    )
    .replace(
      /^I still need to grow in /i,
      "The area where I still need to grow is ",
    );
}

function lowercaseFirst(value: string): string {
  if (!value) return value;
  return `${value[0]?.toLowerCase() ?? ""}${value.slice(1)}`;
}

function buildBehaviouralAnswer(
  _input: PracticeAnalysisInput,
  sentences: readonly string[],
): string {
  const situation = selectDistinctIdeas(
    sentences.filter((sentence) =>
      containsPattern(sentence, SITUATION_PATTERN),
    ),
    2,
  );
  const actions = selectDistinctIdeas(
    sentences.filter(
      (sentence) =>
        !situation.includes(sentence) &&
        (containsPattern(sentence, ACTION_PATTERN) ||
          /\bI\s+(?:handled|helped|spoke|organized|organised|supported|managed|prioritized|prioritised|communicated|reviewed|prepared|trained|asked|listened|recommended|decided|worked|followed|escalated|arranged|confirmed|checked|explained)\b/i.test(
            sentence,
          )),
    ),
    4,
  );
  const outcomes = selectDistinctIdeas(
    sentences.filter(
      (sentence) =>
        !situation.includes(sentence) &&
        !actions.includes(sentence) &&
        (containsPattern(sentence, OUTCOME_PATTERN) ||
          /\b(?:learned|customer was|client was|team was|feedback|successful|resolved|completed|accepted|approved|thanked|confirmed)\b/i.test(
            sentence,
          )),
    ),
    2,
  );

  const unused = sentences.filter(
    (sentence) =>
      !situation.includes(sentence) &&
      !actions.includes(sentence) &&
      !outcomes.includes(sentence),
  );

  return composeUniqueParagraphs([
    situation.join(" ") || unused.shift() || "",
    actions.join(" ") || unused.splice(0, 2).join(" "),
    outcomes.join(" ") || unused.shift() || "",
  ]);
}

function buildSituationalAnswer(
  _input: PracticeAnalysisInput,
  sentences: readonly string[],
): string {
  const firstStep = selectDistinctIdeas(
    sentences.filter((sentence) =>
      /\b(?:first|start|begin|initially|I would|I’d|my approach)\b/i.test(
        sentence,
      ),
    ),
    2,
  );
  const actions = selectDistinctIdeas(
    sentences.filter(
      (sentence) =>
        !firstStep.includes(sentence) &&
        /\b(?:then|next|after|communicat|listen|ask|review|check|confirm|prioriti[sz]|document|escalat|support|resolve|follow up|protect|ensure)\b/i.test(
          sentence,
        ),
    ),
    4,
  );
  const resolution = selectDistinctIdeas(
    sentences.filter(
      (sentence) =>
        !firstStep.includes(sentence) &&
        !actions.includes(sentence) &&
        /\b(?:result|resolved|confirm|follow up|successful|satisfied|safe|complete|measure|learn|prevent)\b/i.test(
          sentence,
        ),
    ),
    2,
  );

  return composeUniqueParagraphs([
    firstStep.join(" ") || sentences[0] || "",
    actions.join(" "),
    resolution.join(" "),
  ]);
}

function buildGeneralAnswer(
  input: PracticeAnalysisInput,
  sentences: readonly string[],
): string {
  const questionTokens = new Set(significantTokens(input.question.text));
  const direct = selectDistinctIdeas(
    sentences.filter((sentence) => overlapScore(sentence, questionTokens) > 0),
    2,
  );
  const evidence = selectDistinctIdeas(
    sentences.filter(
      (sentence) =>
        !direct.includes(sentence) &&
        (containsPattern(sentence, ACTION_PATTERN) ||
          containsPattern(sentence, OUTCOME_PATTERN) ||
          /\b(?:example|experience|because|learned|responsible|skill)\b/i.test(
            sentence,
          )),
    ),
    4,
  );
  const remaining = sentences.filter(
    (sentence) => !direct.includes(sentence) && !evidence.includes(sentence),
  );

  return composeUniqueParagraphs([
    direct.join(" ") || sentences[0] || "",
    evidence.join(" "),
    remaining.slice(0, 2).join(" "),
  ]);
}

function makeTransferableOpening(sentence: string): string {
  if (!sentence) return "";
  if (
    /\b(?:most transferable|strongest transferable|what I bring)\b/i.test(
      sentence,
    )
  ) {
    return sentence;
  }
  const cleaned = sentence
    .replace(/^I (?:think|believe|would say)\s+(?:that\s+)?/i, "")
    .replace(/^My experience\s+(?:has|is)\s+/i, "")
    .trim();
  if (!cleaned) return sentence;
  const lowered = cleaned[0]?.toLowerCase() + cleaned.slice(1);
  return `My most transferable experience is ${lowered}`;
}

function takeUnusedGroups(
  allSentences: readonly string[],
  groups: readonly (readonly string[])[],
): string[][] {
  const used: string[] = [];
  const result = groups.map((group) => {
    const selected = selectDistinctIdeas(
      group.filter(
        (candidate) =>
          !used.some((existing) => ideaSimilarity(existing, candidate) >= 0.58),
      ),
      4,
    );
    used.push(...selected);
    return selected;
  });

  const leftovers = allSentences.filter(
    (candidate) =>
      !used.some((existing) => ideaSimilarity(existing, candidate) >= 0.58),
  );
  for (const group of result) {
    while (group.length < 2 && leftovers.length > 0) {
      const candidate = leftovers.shift();
      if (candidate) {
        group.push(candidate);
        used.push(candidate);
      }
    }
  }
  return result;
}

function relevanceClosing(
  input: PracticeAnalysisInput,
  fallback = "That experience is relevant because it shows how I would contribute in this role.",
): string {
  const jobTitle = input.context?.jobTitle.trim();
  return jobTitle
    ? `That experience would help me contribute as a ${jobTitle}.`
    : fallback;
}

function answerSentences(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  const parts = normalized
    .split(/\n{2,}|(?<=[.!?])\s+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (parts.length > 1) return parts;

  const words = normalized.replace(/\s+/g, " ").split(" ");
  if (words.length <= 55) return [normalized.replace(/\s+/g, " ")];
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += 45) {
    chunks.push(words.slice(index, index + 45).join(" "));
  }
  return chunks;
}

function cleanAnswerSentence(sentence: string): string {
  const cleaned = sentence
    .replace(
      /^(?:(?:um+|uh+|you know|basically|actually|like|sort of|kind of|so)\b[,.]?\s*)+/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const capitalized = cleaned[0]?.toUpperCase() + cleaned.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function containsPattern(text: string, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  const result = pattern.test(text);
  pattern.lastIndex = 0;
  return result;
}

function overlapScore(
  sentence: string,
  questionTokens: ReadonlySet<string>,
): number {
  return significantTokens(sentence).filter((token) =>
    questionTokens.has(token),
  ).length;
}

function selectUniqueSentences(
  candidates: readonly string[],
  maximum: number,
): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = candidate
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    selected.push(candidate);
    if (selected.length >= maximum) break;
  }
  return selected;
}

function technicalValidationPrompt(question: string): string {
  const subject = /dependency|service|provider|integration/i.test(question)
    ? "the dependency failure path"
    : "the failure path";
  return `I would validate ${subject} with automated tests, controlled failure scenarios, useful logs and metrics, and alerts tied to user impact. I would also document the degraded behaviour and recovery procedure so the feature remains understandable when the dependency is unavailable.`;
}

function followUps(
  input: PracticeAnalysisInput,
  hasAction: boolean,
  hasOutcome: boolean,
): readonly string[] {
  const first = hasAction
    ? "What was the hardest decision or trade-off you made?"
    : "What did you personally do, rather than the team in general?";
  const second = hasOutcome
    ? "What would you change if you handled the same situation again?"
    : "What changed for the user, customer, team, or system as a result?";
  if (input.question.category === "software-technical") {
    return [
      "How would this design behave when a dependency fails or traffic increases?",
      "How would you test and monitor the approach in production?",
    ];
  }
  return [first, second];
}

function deliveryObservations(input: PracticeAnalysisInput): readonly string[] {
  const observations: string[] = [];
  const duration = input.answerDurationMs;
  if (duration !== undefined) {
    if (duration < 15_000) {
      observations.push(
        "The answer was under 15 seconds, so it may need more supporting detail.",
      );
    } else if (duration > 180_000) {
      observations.push(
        "The answer ran longer than three minutes; consider a tighter first response.",
      );
    } else {
      observations.push(
        "The answer duration was within a common practice range.",
      );
    }
  }

  const audio = input.audioMetrics;
  if (!audio) {
    observations.push("Audio delivery measurements were not available.");
    return observations;
  }
  if (audio.warnings.includes("possible-clipping")) {
    observations.push(
      "The microphone may have clipped; reduce input level or move slightly farther away.",
    );
  }
  if (audio.warnings.includes("high-noise-floor")) {
    observations.push("Background or device noise was high during capture.");
  }
  if (audio.warnings.includes("insufficient-speech")) {
    observations.push(
      "Not enough speech was detected for reliable delivery timing.",
    );
  }
  if (audio.longestInternalSilenceMs.status !== "unavailable") {
    const pause = audio.longestInternalSilenceMs.value;
    if (pause > 5_000) {
      observations.push(
        "A pause longer than five seconds was detected; a brief silent pause is fine, but restart with a clear next point.",
      );
    }
  }
  return observations.length > 0
    ? observations
    : ["No notable audio-condition warning was produced."];
}

function directOpening(question: string): string {
  const cleaned = question.replace(/\s+/g, " ").trim();
  if (/tell me about a time/i.test(cleaned)) {
    return "A relevant example was when…";
  }
  if (/how would you|how do you/i.test(cleaned)) {
    return "My approach would be to first clarify the constraints, then…";
  }
  return "The main point I would emphasize is…";
}

function findResumeEvidence(
  resumeText: string | undefined,
  question: string,
): string | undefined {
  if (!resumeText?.trim()) {
    return undefined;
  }
  const questionWords = new Set(significantTokens(question));
  const candidates = resumeText
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 25 && line.length <= 220);
  let best: { line: string; score: number } | undefined;
  for (const line of candidates) {
    const score = significantTokens(line).filter((word) =>
      questionWords.has(word),
    ).length;
    if (!best || score > best.score) {
      best = { line, score };
    }
  }
  return best && best.score > 0 ? truncate(best.line, 180) : undefined;
}

function summarizeTranscript(text: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return truncate(sentences.slice(0, 2).join(" ") || text, 240);
}

function truncate(text: string, maximum: number): string {
  if (text.length <= maximum) return text;
  const sliced = text.slice(0, Math.max(0, maximum - 1));
  const boundary = sliced.lastIndexOf(" ");
  const safe =
    boundary >= Math.floor(maximum * 0.65) ? sliced.slice(0, boundary) : sliced;
  return `${safe.trimEnd()}…`;
}

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]*/g) ?? []).filter(
    Boolean,
  );
}

function significantTokens(text: string): string[] {
  return [
    ...new Set(
      tokens(text).filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
    ),
  ];
}

function matches(text: string, pattern: RegExp): RegExpMatchArray[] {
  pattern.lastIndex = 0;
  const results = [...text.matchAll(pattern)];
  pattern.lastIndex = 0;
  return results;
}

function evidence(
  text: string,
  pattern: RegExp,
  evidenceType: EvidenceSpan["evidenceType"],
): EvidenceSpan[] {
  return matches(text, pattern)
    .slice(0, 8)
    .map((match) => ({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      text: match[0],
      evidenceType,
    }));
}

function firstTokenEvidence(
  text: string,
  token: string,
): EvidenceSpan | undefined {
  const index = text.toLowerCase().indexOf(token.toLowerCase());
  return index < 0
    ? undefined
    : {
        start: index,
        end: index + token.length,
        text: text.slice(index, index + token.length),
        evidenceType: "keyword",
      };
}

function isEvidence(value: EvidenceSpan | undefined): value is EvidenceSpan {
  return value !== undefined;
}

function averageSentenceLength(text: string): number {
  const sentences = text
    .split(/[.!?]+/)
    .map((sentence) => tokens(sentence).length)
    .filter((length) => length > 0);
  if (sentences.length === 0) return tokens(text).length;
  return Math.round(
    sentences.reduce((sum, length) => sum + length, 0) / sentences.length,
  );
}
