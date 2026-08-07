import { questionTemplateId } from "../../domain/factories";
import type {
  InterviewCategory,
  InterviewDifficulty,
  QuestionTag,
  QuestionTemplate,
} from "../../domain/models";

type BuiltInCategory = Exclude<InterviewCategory, "custom-mixed">;

export const QUESTION_PROVIDER_VERSION = "local-question-provider-v1";
export const KEYWORD_EXTRACTOR_VERSION = "keyword-extractor-v1";

export const requiredQuestionBanks: readonly BuiltInCategory[] = [
  "general-behavioural",
  "software-technical",
  "customer-service",
  "leadership",
  "investigative",
];

export const questionCatalogue: readonly QuestionTemplate[] = [
  t(
    "QB-GEN-001",
    "general-behavioural",
    "foundational",
    "Tell me about yourself and the experience you would bring to a {jobTitle} role.",
    ["introduction", "communication", "reflection"],
  ),
  t(
    "QB-GEN-002",
    "general-behavioural",
    "foundational",
    "Why are you interested in this {jobTitle} opportunity{companyClause}?",
    ["motivation", "communication"],
  ),
  t(
    "QB-GEN-003",
    "general-behavioural",
    "foundational",
    "What is one strength you would use regularly in this role?",
    ["motivation", "reflection"],
  ),
  t(
    "QB-GEN-004",
    "general-behavioural",
    "standard",
    "Tell me about a time you solved a difficult problem. What did you personally do?",
    ["problem-solving", "ownership"],
  ),
  t(
    "QB-GEN-005",
    "general-behavioural",
    "standard",
    "Describe a time priorities changed unexpectedly. How did you respond?",
    ["prioritization", "adaptability"],
  ),
  t(
    "QB-GEN-006",
    "general-behavioural",
    "standard",
    "Tell me about a mistake or setback and what you changed afterward.",
    ["learning", "reflection"],
  ),
  t(
    "QB-GEN-007",
    "general-behavioural",
    "standard",
    "Describe a time you had to learn a new skill or process quickly.",
    ["learning", "adaptability"],
  ),
  t(
    "QB-GEN-008",
    "general-behavioural",
    "standard",
    "Tell me about a disagreement at work or school and how you handled it.",
    ["conflict", "communication"],
  ),
  t(
    "QB-GEN-009",
    "general-behavioural",
    "standard",
    "Give an example of how you managed several deadlines at once.",
    ["prioritization", "delivery"],
  ),
  t(
    "QB-GEN-010",
    "general-behavioural",
    "advanced",
    "Describe a decision you made with incomplete information. What trade-offs did you consider?",
    ["problem-solving", "trade-off"],
  ),
  t(
    "QB-GEN-011",
    "general-behavioural",
    "advanced",
    "Tell me about a time your first approach did not work. How did you diagnose and revise it?",
    ["problem-solving", "learning"],
  ),
  t(
    "QB-GEN-012",
    "general-behavioural",
    "advanced",
    "Which part of your experience is most transferable to {jobTitle}, and where would you still need to grow?",
    ["reflection", "motivation"],
  ),

  t(
    "QB-TEC-001",
    "software-technical",
    "foundational",
    "Walk me through a recent software project and your contribution.",
    ["technical-depth", "ownership"],
  ),
  t(
    "QB-TEC-002",
    "software-technical",
    "foundational",
    "Which technologies are you most comfortable using, and how have you applied them?",
    ["technical-depth", "communication"],
  ),
  t(
    "QB-TEC-003",
    "software-technical",
    "foundational",
    "How do you approach debugging when an application is not behaving as expected?",
    ["debugging", "problem-solving"],
  ),
  t(
    "QB-TEC-004",
    "software-technical",
    "standard",
    "Tell me about an API you designed or integrated. What decisions mattered?",
    ["api", "trade-off"],
  ),
  t(
    "QB-TEC-005",
    "software-technical",
    "standard",
    "Describe how you have modelled, stored, or queried application data.",
    ["data", "technical-depth"],
  ),
  t(
    "QB-TEC-006",
    "software-technical",
    "standard",
    "Give an example of improving accessibility, responsiveness, or usability in an interface.",
    ["accessibility", "delivery"],
  ),
  t(
    "QB-TEC-007",
    "software-technical",
    "standard",
    "How do you test a feature before considering it complete?",
    ["testing", "delivery"],
  ),
  t(
    "QB-TEC-008",
    "software-technical",
    "standard",
    "Tell me about a Git, CI/CD, container, or deployment problem you resolved.",
    ["delivery", "debugging"],
  ),
  t(
    "QB-TEC-009",
    "software-technical",
    "standard",
    "Describe a security or privacy consideration you handled in a project.",
    ["security-privacy", "trade-off"],
  ),
  t(
    "QB-TEC-010",
    "software-technical",
    "advanced",
    "Design a high-level approach for a {keyword} feature that must remain reliable when a dependency fails.",
    ["technical-depth", "trade-off"],
  ),
  t(
    "QB-TEC-011",
    "software-technical",
    "advanced",
    "Describe a technical trade-off you made involving performance, maintainability, or delivery time.",
    ["trade-off", "delivery"],
  ),
  t(
    "QB-TEC-012",
    "software-technical",
    "advanced",
    "A production issue appears only for some users. How would you investigate, contain, and verify a fix?",
    ["debugging", "testing"],
  ),

  t(
    "QB-CS-001",
    "customer-service",
    "foundational",
    "What does good customer service mean to you?",
    ["customer", "communication"],
  ),
  t(
    "QB-CS-002",
    "customer-service",
    "foundational",
    "Tell me about a time you helped someone understand a confusing process.",
    ["customer", "communication"],
  ),
  t(
    "QB-CS-003",
    "customer-service",
    "foundational",
    "How do you stay calm when a customer is frustrated?",
    ["customer", "adaptability"],
  ),
  t(
    "QB-CS-004",
    "customer-service",
    "standard",
    "Describe a difficult customer interaction and the outcome.",
    ["customer", "reflection"],
  ),
  t(
    "QB-CS-005",
    "customer-service",
    "standard",
    "Tell me about a time you could not give a customer exactly what they requested.",
    ["customer", "trade-off"],
  ),
  t(
    "QB-CS-006",
    "customer-service",
    "standard",
    "Give an example of finding the root cause behind a recurring customer issue.",
    ["customer", "problem-solving"],
  ),
  t(
    "QB-CS-007",
    "customer-service",
    "standard",
    "How have you balanced speed with accuracy in a service environment?",
    ["customer", "prioritization"],
  ),
  t(
    "QB-CS-008",
    "customer-service",
    "standard",
    "Tell me about feedback from a customer or colleague that changed your approach.",
    ["customer", "learning"],
  ),
  t(
    "QB-CS-009",
    "customer-service",
    "standard",
    "Describe how you documented or escalated an issue for another team.",
    ["customer", "documentation"],
  ),
  t(
    "QB-CS-010",
    "customer-service",
    "advanced",
    "A customer reports an urgent problem with limited evidence. How would you investigate and communicate?",
    ["customer", "investigation"],
  ),
  t(
    "QB-CS-011",
    "customer-service",
    "advanced",
    "Tell me about a time policy and customer expectations conflicted. What did you do?",
    ["customer", "trade-off"],
  ),
  t(
    "QB-CS-012",
    "customer-service",
    "advanced",
    "How would you identify whether a service problem is isolated or systemic?",
    ["customer", "problem-solving"],
  ),

  t(
    "QB-LEAD-001",
    "leadership",
    "foundational",
    "Describe a time you took ownership without being asked.",
    ["leadership", "ownership"],
  ),
  t(
    "QB-LEAD-002",
    "leadership",
    "foundational",
    "How do you communicate expectations when working with others?",
    ["leadership", "communication"],
  ),
  t(
    "QB-LEAD-003",
    "leadership",
    "foundational",
    "Tell me about a time you supported a teammate's development.",
    ["leadership", "learning"],
  ),
  t(
    "QB-LEAD-004",
    "leadership",
    "standard",
    "Describe a project or initiative you led and how you kept it on track.",
    ["leadership", "delivery"],
  ),
  t(
    "QB-LEAD-005",
    "leadership",
    "standard",
    "Tell me about a time you delegated work. How did you decide what to delegate?",
    ["leadership", "prioritization"],
  ),
  t(
    "QB-LEAD-006",
    "leadership",
    "standard",
    "Give an example of resolving conflict within a team.",
    ["leadership", "conflict"],
  ),
  t(
    "QB-LEAD-007",
    "leadership",
    "standard",
    "Describe how you handled resistance to a change.",
    ["leadership", "adaptability"],
  ),
  t(
    "QB-LEAD-008",
    "leadership",
    "standard",
    "Tell me about a decision that affected other people and how you communicated it.",
    ["leadership", "communication"],
  ),
  t(
    "QB-LEAD-009",
    "leadership",
    "standard",
    "How have you used documentation, training, or process improvement to strengthen a team?",
    ["leadership", "documentation"],
  ),
  t(
    "QB-LEAD-010",
    "leadership",
    "advanced",
    "Describe a time you had to balance team wellbeing, quality, and a hard deadline.",
    ["leadership", "trade-off"],
  ),
  t(
    "QB-LEAD-011",
    "leadership",
    "advanced",
    "Tell me about a leadership decision you would now make differently.",
    ["leadership", "reflection"],
  ),
  t(
    "QB-LEAD-012",
    "leadership",
    "advanced",
    "How would you lead a response when ownership is unclear and the impact is growing?",
    ["leadership", "ownership"],
  ),

  t(
    "QB-INV-001",
    "investigative",
    "foundational",
    "Describe your approach to gathering and organizing information.",
    ["investigation", "documentation"],
  ),
  t(
    "QB-INV-002",
    "investigative",
    "foundational",
    "Tell me about a time careful observation helped you identify an issue.",
    ["investigation", "evidence"],
  ),
  t(
    "QB-INV-003",
    "investigative",
    "foundational",
    "How do you separate facts, assumptions, and unanswered questions?",
    ["investigation", "evidence"],
  ),
  t(
    "QB-INV-004",
    "investigative",
    "standard",
    "Describe an investigation or research task and the steps you personally completed.",
    ["investigation", "ownership"],
  ),
  t(
    "QB-INV-005",
    "investigative",
    "standard",
    "Tell me about a time sources or accounts conflicted. How did you assess them?",
    ["investigation", "evidence"],
  ),
  t(
    "QB-INV-006",
    "investigative",
    "standard",
    "Give an example of documenting findings for someone who was not present.",
    ["investigation", "documentation"],
  ),
  t(
    "QB-INV-007",
    "investigative",
    "standard",
    "How have you protected confidential or sensitive information?",
    ["investigation", "confidentiality"],
  ),
  t(
    "QB-INV-008",
    "investigative",
    "standard",
    "Tell me about a time new evidence changed your working theory.",
    ["investigation", "learning"],
  ),
  t(
    "QB-INV-009",
    "investigative",
    "standard",
    "Describe how you maintained accuracy during a long or repetitive assignment.",
    ["investigation", "delivery"],
  ),
  t(
    "QB-INV-010",
    "investigative",
    "advanced",
    "You have a deadline, incomplete evidence, and several plausible explanations. How do you proceed?",
    ["investigation", "trade-off"],
  ),
  t(
    "QB-INV-011",
    "investigative",
    "advanced",
    "Describe a decision about when to continue investigating and when to conclude.",
    ["investigation", "trade-off"],
  ),
  t(
    "QB-INV-012",
    "investigative",
    "advanced",
    "Tell me about presenting a defensible finding while clearly communicating its limits.",
    ["investigation", "communication"],
  ),
];

export const recoveryQuestionTemplates: readonly string[] = [
  "Tell me about a recent example that shows how you approach work.",
  "Describe a time you adapted when something important changed.",
  "What is one project or responsibility you would want an interviewer to understand?",
  "Tell me about a time you learned from feedback.",
  "Describe a decision where you had to weigh trade-offs.",
];

export function countTemplatesByBank() {
  return requiredQuestionBanks.map((category) => ({
    category,
    count: questionCatalogue.filter(
      (template) => template.category === category,
    ).length,
  }));
}

function t(
  id: string,
  category: BuiltInCategory,
  difficulty: InterviewDifficulty,
  template: string,
  tags: readonly QuestionTag[],
): QuestionTemplate {
  return {
    id: questionTemplateId(id),
    category,
    difficulty,
    template,
    tags,
    allowedTokens: detectAllowedTokens(template),
    fallbackText: renderFallback(template),
  };
}

function detectAllowedTokens(
  template: string,
): readonly ("jobTitle" | "companyClause" | "keyword")[] {
  return [
    template.includes("{jobTitle}") ? "jobTitle" : null,
    template.includes("{companyClause}") ? "companyClause" : null,
    template.includes("{keyword}") ? "keyword" : null,
  ].filter((token): token is "jobTitle" | "companyClause" | "keyword" =>
    Boolean(token),
  );
}

function renderFallback(template: string) {
  return template
    .replace(/\{jobTitle\}/g, "this role")
    .replace(/\{companyClause\}/g, "")
    .replace(/\{keyword\}/g, "the role");
}
