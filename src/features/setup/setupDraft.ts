import type {
  InterviewCategory,
  InterviewContext,
  InterviewDifficulty,
  InterviewQuestion,
  InterviewSettings,
  LiveCoachingPreference,
  QuestionSelectionReason,
  TimingMode,
  TranscriptionPreference,
  ExtractedKeyword,
} from "../../domain/models";
import { milliseconds } from "../../domain/factories";
import { DEFAULT_INTERVIEW_SETTINGS } from "../settings/defaults";
import type {
  CompanyResearchSnapshot,
  JobPostingImportSnapshot,
  ResumeMetadata,
} from "./jobContext";
import { normalizeHttpUrl } from "./jobContext";

export type SetupStorageMode = "persistent" | "ephemeral";

export interface SetupDraft {
  readonly sessionSeed: string;
  readonly jobTitle: string;
  readonly company: string;
  readonly companyWebsiteUrl: string;
  readonly normalizedCompanyWebsiteUrl?: string | undefined;
  readonly jobPostingUrl: string;
  readonly normalizedJobPostingUrl?: string | undefined;
  readonly jobPostingImport?: JobPostingImportSnapshot | undefined;
  readonly jobDescription: string;
  readonly resumeText: string;
  readonly resumeMetadata?: ResumeMetadata | undefined;
  readonly companyResearchConsentAcceptedAt?: string | undefined;
  readonly companyResearch?: CompanyResearchSnapshot | undefined;
  readonly category: InterviewCategory;
  readonly difficulty: InterviewDifficulty;
  readonly questionCount: number;
  readonly preparationTimeSeconds: number;
  readonly answerTimeSeconds: number;
  readonly timingMode: TimingMode;
  readonly liveCoaching: LiveCoachingPreference;
  readonly transcription: TranscriptionPreference;
  readonly cameraRequested: boolean;
  readonly microphoneRequested: boolean;
  readonly recordingCaptureRequested: boolean;
  readonly customQuestions: readonly string[];
  readonly generatedQuestions: readonly InterviewQuestion[];
  readonly extractedKeywords: readonly ExtractedKeyword[];
  readonly questionSelectionReasons: readonly QuestionSelectionReason[];
  readonly storageMode: SetupStorageMode;
}

export interface SetupValidationError {
  readonly fieldId: string;
  readonly message: string;
}

export const interviewCategoryOptions: readonly {
  readonly value: InterviewCategory;
  readonly label: string;
}[] = [
  { value: "general-behavioural", label: "General" },
  { value: "software-technical", label: "Software/technical" },
  { value: "customer-service", label: "Customer service" },
  { value: "leadership", label: "Leadership" },
  { value: "investigative", label: "Investigative" },
  { value: "custom-mixed", label: "Custom/mixed" },
];

export const difficultyOptions: readonly {
  readonly value: InterviewDifficulty;
  readonly label: string;
}[] = [
  { value: "foundational", label: "Foundational" },
  { value: "standard", label: "Standard" },
  { value: "advanced", label: "Advanced" },
];

export const timingModeOptions: readonly {
  readonly value: TimingMode;
  readonly label: string;
  readonly help: string;
}[] = [
  {
    value: "flexible",
    label: "Flexible",
    help: "Shows the target time and lets you continue.",
  },
  {
    value: "strictPractice",
    label: "Strict practice",
    help: "Ends the answer when time expires. You can extend the time, and you may switch modes before starting.",
  },
  {
    value: "untimed",
    label: "Untimed",
    help: "No countdown or automatic transition.",
  },
];

export const liveCoachingOptions: readonly {
  readonly value: LiveCoachingPreference;
  readonly label: string;
  readonly help: string;
}[] = [
  {
    value: "off",
    label: "Off",
    help: "No live prompts appear while you answer.",
  },
  {
    value: "delivery-timing",
    label: "Delivery and timing prompts",
    help: "Shows quiet prompts about time, microphone conditions, and camera setup.",
  },
  {
    value: "answer-structure",
    label: "Answer-structure prompts",
    help: "Suggests when to add an example, explain your action, describe the result, or connect to the role.",
  },
  {
    value: "both",
    label: "Both",
    help: "Uses delivery, timing, and answer-structure prompts with a shared cooldown.",
  },
];

export const transcriptionOptions: readonly {
  readonly value: TranscriptionPreference;
  readonly label: string;
}[] = [
  { value: "ask-when-supported", label: "Ask when supported" },
  { value: "manual", label: "Manual transcript" },
  { value: "timing-only", label: "Timing only" },
];

export function createDefaultSetupDraft(): SetupDraft {
  return {
    sessionSeed: "draft",
    jobTitle: "",
    company: "",
    companyWebsiteUrl: "",
    jobPostingUrl: "",
    jobDescription: "",
    resumeText: "",
    category: "general-behavioural",
    difficulty: "standard",
    questionCount: DEFAULT_INTERVIEW_SETTINGS.questionCount,
    preparationTimeSeconds: Math.round(
      DEFAULT_INTERVIEW_SETTINGS.preparationTimeMs / 1000,
    ),
    answerTimeSeconds: Math.round(
      DEFAULT_INTERVIEW_SETTINGS.answerTimeMs / 1000,
    ),
    timingMode: DEFAULT_INTERVIEW_SETTINGS.timingMode,
    liveCoaching: DEFAULT_INTERVIEW_SETTINGS.liveCoaching,
    transcription: DEFAULT_INTERVIEW_SETTINGS.transcription,
    cameraRequested: DEFAULT_INTERVIEW_SETTINGS.cameraRequested,
    microphoneRequested: DEFAULT_INTERVIEW_SETTINGS.microphoneRequested,
    recordingCaptureRequested:
      DEFAULT_INTERVIEW_SETTINGS.recordingCaptureRequested,
    customQuestions: ["", "", ""],
    generatedQuestions: [],
    extractedKeywords: [],
    questionSelectionReasons: [],
    storageMode: "persistent",
  };
}

export function createFreshSessionSeed(): string {
  const candidate =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return sanitizeSessionSeed(candidate);
}

export function withFreshSessionSeed(
  draft: SetupDraft,
  seed = createFreshSessionSeed(),
): SetupDraft {
  return {
    ...draft,
    sessionSeed: sanitizeSessionSeed(seed),
  };
}

export function sanitizeSessionSeed(seed: string): string {
  const sanitized = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return sanitized.length > 0 ? sanitized : "started";
}

export function updateCustomQuestion(
  draft: SetupDraft,
  index: number,
  text: string,
): SetupDraft {
  const questions = [...draft.customQuestions];
  questions[index] = text;

  return {
    ...draft,
    customQuestions: questions,
  };
}

export function addCustomQuestion(draft: SetupDraft): SetupDraft {
  return {
    ...draft,
    customQuestions: [...draft.customQuestions, ""],
  };
}

export function moveCustomQuestion(
  draft: SetupDraft,
  fromIndex: number,
  toIndex: number,
): SetupDraft {
  const questions = [...draft.customQuestions];
  const [question] = questions.splice(fromIndex, 1);
  if (question === undefined) {
    return draft;
  }

  questions.splice(toIndex, 0, question);
  return {
    ...draft,
    customQuestions: questions,
  };
}

export function removeCustomQuestion(
  draft: SetupDraft,
  index: number,
): SetupDraft {
  return {
    ...draft,
    customQuestions: draft.customQuestions.filter(
      (_, questionIndex) => questionIndex !== index,
    ),
  };
}

export function replaceGeneratedQuestions(
  draft: SetupDraft,
  questions: readonly InterviewQuestion[],
): SetupDraft {
  return {
    ...draft,
    generatedQuestions: questions.map((question, order) => ({
      ...question,
      order,
    })),
  };
}

export function replaceResumeText(draft: SetupDraft, resumeText: string) {
  return clearGeneratedQuestionSnapshot({
    ...draft,
    resumeText,
  });
}

export function replaceResume(
  draft: SetupDraft,
  resumeText: string,
  resumeMetadata: ResumeMetadata | undefined,
) {
  return clearGeneratedQuestionSnapshot({
    ...draft,
    resumeText,
    ...(resumeMetadata === undefined
      ? { resumeMetadata: undefined }
      : { resumeMetadata }),
  });
}

export function updateJobContext(
  draft: SetupDraft,
  update: Partial<
    Pick<
      SetupDraft,
      | "company"
      | "companyWebsiteUrl"
      | "jobDescription"
      | "jobTitle"
      | "jobPostingUrl"
      | "jobPostingImport"
      | "normalizedCompanyWebsiteUrl"
      | "normalizedJobPostingUrl"
      | "companyResearch"
    >
  > & {
    readonly companyResearch?: CompanyResearchSnapshot | undefined;
    readonly jobPostingImport?: JobPostingImportSnapshot | undefined;
    readonly normalizedCompanyWebsiteUrl?: string | undefined;
    readonly normalizedJobPostingUrl?: string | undefined;
  },
) {
  return clearGeneratedQuestionSnapshot({
    ...draft,
    ...update,
  });
}

export function clearGeneratedQuestionSnapshot(draft: SetupDraft): SetupDraft {
  if (
    draft.generatedQuestions.length === 0 &&
    draft.extractedKeywords.length === 0 &&
    draft.questionSelectionReasons.length === 0
  ) {
    return draft;
  }

  return {
    ...draft,
    generatedQuestions: [],
    extractedKeywords: [],
    questionSelectionReasons: [],
  };
}

export function validateSetupDraft(
  draft: SetupDraft,
): readonly SetupValidationError[] {
  const errors: SetupValidationError[] = [];

  if (draft.jobTitle.trim().length === 0) {
    errors.push({
      fieldId: "job-title",
      message: "Job title is required.",
    });
  }

  addMaxLengthError(errors, "job-title", "Job title", draft.jobTitle, 120);
  addMaxLengthError(errors, "company", "Company", draft.company, 120);
  addUrlError(
    errors,
    "company-website-url",
    "Company website URL",
    draft.companyWebsiteUrl,
  );
  addUrlError(
    errors,
    "job-posting-url",
    "Job posting URL",
    draft.jobPostingUrl,
  );
  addMaxLengthError(
    errors,
    "job-description",
    "Job description",
    draft.jobDescription,
    20_000,
  );
  addMaxLengthError(
    errors,
    "resume-file",
    "Extracted résumé text",
    draft.resumeText,
    20_000,
  );

  if (!Number.isInteger(draft.questionCount) || draft.questionCount < 1) {
    errors.push({
      fieldId: "question-count",
      message: "Questions must be at least 1.",
    });
  } else if (draft.questionCount > 10) {
    errors.push({
      fieldId: "question-count",
      message: "Questions must be 10 or fewer.",
    });
  }

  if (
    !Number.isInteger(draft.preparationTimeSeconds) ||
    draft.preparationTimeSeconds < 0
  ) {
    errors.push({
      fieldId: "preparation-time",
      message: "Preparation time cannot be negative.",
    });
  } else if (draft.preparationTimeSeconds > 600) {
    errors.push({
      fieldId: "preparation-time",
      message: "Preparation time must be 600 seconds or less.",
    });
  }

  if (
    !Number.isInteger(draft.answerTimeSeconds) ||
    draft.answerTimeSeconds < 30
  ) {
    errors.push({
      fieldId: "answer-time",
      message: "Answer time must be at least 30 seconds.",
    });
  } else if (draft.answerTimeSeconds > 1200) {
    errors.push({
      fieldId: "answer-time",
      message: "Answer time must be 1200 seconds or less.",
    });
  }

  if (
    draft.recordingCaptureRequested &&
    !draft.cameraRequested &&
    !draft.microphoneRequested
  ) {
    errors.push({
      fieldId: "recording-capture",
      message: "Recording capture needs camera, microphone, or both selected.",
    });
  }

  draft.customQuestions.forEach((question, index) => {
    addMaxLengthError(
      errors,
      `custom-question-${index}`,
      `Custom question ${index + 1}`,
      question,
      300,
    );
  });

  return errors;
}

export function toInterviewContext(draft: SetupDraft): InterviewContext {
  const company = optionalText(draft.company);
  const companyWebsiteUrl = optionalText(
    draft.normalizedCompanyWebsiteUrl ?? draft.companyWebsiteUrl,
  );
  const jobPostingUrl = optionalText(
    draft.normalizedJobPostingUrl ?? draft.jobPostingUrl,
  );
  const jobDescription = optionalText(draft.jobDescription);
  const resumeText = optionalText(draft.resumeText);

  return {
    jobTitle: draft.jobTitle.trim(),
    category: draft.category,
    difficulty: draft.difficulty,
    locale: "en-CA",
    ...(company === undefined ? {} : { company }),
    ...(companyWebsiteUrl === undefined ? {} : { companyWebsiteUrl }),
    ...(jobPostingUrl === undefined ? {} : { jobPostingUrl }),
    ...(draft.jobPostingImport === undefined
      ? {}
      : { jobPostingImport: draft.jobPostingImport }),
    ...(draft.resumeMetadata === undefined
      ? {}
      : { resumeMetadata: draft.resumeMetadata }),
    ...(draft.companyResearch === undefined
      ? {}
      : { companyResearch: draft.companyResearch }),
    ...(jobDescription === undefined ? {} : { jobDescription }),
    ...(resumeText === undefined ? {} : { resumeText }),
  };
}

export function toInterviewSettings(draft: SetupDraft): InterviewSettings {
  return {
    ...DEFAULT_INTERVIEW_SETTINGS,
    questionCount: draft.questionCount,
    preparationTimeMs: milliseconds(draft.preparationTimeSeconds * 1000),
    answerTimeMs: milliseconds(draft.answerTimeSeconds * 1000),
    timingMode: draft.timingMode,
    liveCoaching: draft.liveCoaching,
    transcription: draft.transcription,
    cameraRequested: draft.cameraRequested,
    microphoneRequested: draft.microphoneRequested,
    recordingCaptureRequested: draft.recordingCaptureRequested,
  };
}

export function hasMeaningfulSetupInput(draft: SetupDraft): boolean {
  const defaultDraft = createDefaultSetupDraft();

  return JSON.stringify(draft) !== JSON.stringify(defaultDraft);
}

export function enabledMediaSummary(draft: SetupDraft): string {
  if (draft.cameraRequested && draft.microphoneRequested) {
    return "Camera and microphone selected";
  }

  if (draft.cameraRequested) {
    return "Camera selected";
  }

  if (draft.microphoneRequested) {
    return "Microphone selected";
  }

  return "No camera or microphone selected";
}

function addMaxLengthError(
  errors: SetupValidationError[],
  fieldId: string,
  label: string,
  value: string,
  maxLength: number,
) {
  if (value.length > maxLength) {
    errors.push({
      fieldId,
      message: `${label} must be ${maxLength.toLocaleString("en-CA")} characters or fewer.`,
    });
  }
}

function addUrlError(
  errors: SetupValidationError[],
  fieldId: string,
  label: string,
  value: string,
) {
  if (value.trim().length === 0) {
    return;
  }

  const normalized = normalizeHttpUrl(value);
  if (!normalized.ok) {
    errors.push({
      fieldId,
      message: `${label}: ${normalized.message}`,
    });
  }
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
