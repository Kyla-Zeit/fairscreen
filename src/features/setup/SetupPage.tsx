import { Plus, Video, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useBrowserServices } from "../../app/BrowserServicesProvider";
import { interviewSessionId, isoDateTime } from "../../domain/factories";
import type { QuestionGenerationRequest } from "../../domain/models";
import { createRecoveryQuestionResult } from "../questions/LocalQuestionProvider";
import { createSessionIdFromDraft } from "../interview/progressPersistence";
import { interviewSessionPath } from "../interview/sessionRoute";
import { prepareCustomQuestions } from "../questions/customQuestions";
import { useQuestionProvider } from "../questions/QuestionProviderContext";
import { Button } from "../../shared/components/Button";
import { Notice } from "../../shared/components/Notice";
import { PageContainer } from "../../shared/components/PageContainer";
import { PageHeader } from "../../shared/components/PageHeader";
import { Status } from "../../shared/components/Status";
import { useSetupDraft } from "./SetupDraftProvider";
import {
  formatFileSize,
  normalizeHttpUrl,
  researchPracticeQuestions,
  safeDisplayFilename,
  type CompanyResearchCandidate,
  type CompanyResearchSnapshot,
  type JobPostingImportSnapshot,
  type ResumeMetadata,
} from "./jobContext";
import { type ResumeImportFormat } from "./resumeImport";
import {
  addCustomQuestion,
  difficultyOptions,
  enabledMediaSummary,
  hasMeaningfulSetupInput,
  interviewCategoryOptions,
  liveCoachingOptions,
  moveCustomQuestion,
  removeCustomQuestion,
  replaceResume,
  replaceGeneratedQuestions,
  timingModeOptions,
  toInterviewContext,
  toInterviewSettings,
  transcriptionOptions,
  updateCustomQuestion,
  updateJobContext,
  validateSetupDraft,
  withFreshSessionSeed,
  type SetupDraft,
  type SetupValidationError,
} from "./setupDraft";

interface ResumeImportUiState {
  readonly message: string | null;
  readonly preview: ResumeImportPreview | null;
  readonly status:
    "idle" | "confirming" | "loading" | "success" | "confirmed" | "error";
}

interface ResumeImportPreview {
  readonly characterCount: number;
  readonly format: ResumeImportFormat | null;
  readonly metadata?: ResumeMetadata;
  readonly text: string;
}

interface JobPostingImportUiState {
  readonly status: "idle" | "loading" | "success" | "error";
  readonly message: string | null;
  readonly review: JobPostingImportSnapshot | null;
}

interface CompanyResearchUiState {
  readonly status:
    "idle" | "consent" | "loading" | "success" | "error" | "ambiguous";
  readonly message: string | null;
  readonly candidates: readonly CompanyResearchCandidate[];
}

export function SetupPage() {
  const navigate = useNavigate();
  const { companyResearch, importJobPosting, importResumeFile } =
    useBrowserServices();
  const questionProvider = useQuestionProvider();
  const { draft, isDirty, replaceDraft, updateDraft } = useSetupDraft();
  const [errors, setErrors] = useState<readonly SetupValidationError[]>([]);
  const [questionMessage, setQuestionMessage] = useState<string | null>(null);
  const [resumeImportState, setResumeImportState] =
    useState<ResumeImportUiState>({
      status: "idle",
      message: null,
      preview: null,
    });
  const [jobImportState, setJobImportState] = useState<JobPostingImportUiState>(
    {
      status: "idle",
      message: null,
      review: null,
    },
  );
  const [researchState, setResearchState] = useState<CompanyResearchUiState>({
    status: "idle",
    message: null,
    candidates: [],
  });
  const [generationState, setGenerationState] = useState<
    "idle" | "generating" | "complete" | "fallback"
  >("idle");
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const pendingResumeFileRef = useRef<File | null>(null);
  const resumeFileInputRef = useRef<HTMLInputElement | null>(null);
  const resumeImportErrorRef = useRef<HTMLParagraphElement | null>(null);
  const errorByField = useMemo(() => createErrorMap(errors), [errors]);
  const confirmedResumePreview = useMemo(
    () =>
      draft.resumeText.trim().length > 0
        ? createResumePreview(null, draft.resumeText, draft.resumeMetadata)
        : null,
    [draft.resumeMetadata, draft.resumeText],
  );
  const visibleResumePreview =
    resumeImportState.preview ?? confirmedResumePreview;
  const normalizedJobPostingUrl = normalizeHttpUrl(draft.jobPostingUrl);
  const safeJobPostingUrl =
    normalizedJobPostingUrl.ok && draft.jobPostingUrl.trim().length > 0
      ? normalizedJobPostingUrl.normalizedUrl
      : null;

  useEffect(() => {
    if (!isDirty) {
      return undefined;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    return () => {
      pendingResumeFileRef.current = null;
      resetResumeFileInput();
    };
  }, []);

  async function handleSubmit(path: "devices" | "no-media") {
    const nextDraft =
      path === "no-media"
        ? {
            ...draft,
            cameraRequested: false,
            microphoneRequested: false,
            recordingCaptureRequested: false,
          }
        : draft;
    const nextErrors = validateSetupDraft(nextDraft);
    setErrors(nextErrors);

    if (nextErrors.length > 0) {
      window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
      return;
    }

    const finalDraft =
      nextDraft.generatedQuestions.length > 0
        ? nextDraft
        : await generateQuestionSet(nextDraft);

    if (!finalDraft) {
      return;
    }

    const startedDraft = withFreshSessionSeed(finalDraft);
    replaceDraft(startedDraft);
    void navigate(
      interviewSessionPath(createSessionIdFromDraft(startedDraft), "devices"),
    );
  }

  function handleCustomQuestionChange(index: number, text: string) {
    updateDraft(updateCustomQuestion(draft, index, text));
  }

  function updateSourceContext(
    update: Parameters<typeof updateJobContext>[1],
    message?: string,
  ) {
    const hadGeneratedQuestions = draft.generatedQuestions.length > 0;
    updateDraft(updateJobContext(draft, update));
    if (hadGeneratedQuestions) {
      setQuestionMessage(
        message ??
          "Question set cleared because job context changed. Generate again before starting.",
      );
      setGenerationState("idle");
    }
  }

  async function importCurrentJobPosting() {
    const normalized = normalizeHttpUrl(draft.jobPostingUrl);
    if (!normalized.ok) {
      setJobImportState({
        status: "error",
        message: normalized.message,
        review: null,
      });
      return;
    }

    const requestedAt = nowIso();
    setJobImportState({
      status: "loading",
      message: "Importing the job posting through the configured provider.",
      review: null,
    });

    const result = await importJobPosting({
      originalUrl: draft.jobPostingUrl,
      normalizedUrl: normalized.normalizedUrl,
      requestedAt,
    });

    if (result.ok) {
      setJobImportState({
        status: "success",
        message:
          "Job posting imported. Review the fields before replacing setup details.",
        review: result.value,
      });
      updateSourceContext({
        normalizedJobPostingUrl: normalized.normalizedUrl,
        jobPostingImport: result.value,
      });
      return;
    }

    setJobImportState({
      status: "error",
      message: result.error.message,
      review: null,
    });
  }

  function useImportedJobPosting() {
    const review = jobImportState.review;
    if (!review) {
      return;
    }

    updateSourceContext(
      {
        jobTitle: review.title ?? draft.jobTitle,
        company: review.companyName ?? draft.company,
        companyWebsiteUrl: review.companyWebsiteUrl ?? draft.companyWebsiteUrl,
        normalizedCompanyWebsiteUrl:
          review.companyWebsiteUrl === undefined
            ? draft.normalizedCompanyWebsiteUrl
            : normalizedUrlOrUndefined(review.companyWebsiteUrl),
        jobDescription: review.description ?? draft.jobDescription,
        jobPostingImport: review,
      },
      "Question set cleared because imported job posting context changed. Generate again before starting.",
    );
    setJobImportState({
      status: "success",
      message: "Imported job posting fields applied to setup.",
      review,
    });
  }

  function focusJobDescription() {
    document.getElementById("job-description")?.focus();
  }

  function requestCompanyResearch() {
    if (!draft.companyResearchConsentAcceptedAt) {
      setResearchState({
        status: "consent",
        message: null,
        candidates: [],
      });
      return;
    }

    void runCompanyResearch();
  }

  async function acceptResearchConsentAndRun() {
    const consentedAt = nowIso();
    updateDraft({ companyResearchConsentAcceptedAt: consentedAt });
    await runCompanyResearch(consentedAt);
  }

  async function runCompanyResearch(
    consentedAt = draft.companyResearchConsentAcceptedAt,
  ) {
    if (!consentedAt) {
      requestCompanyResearch();
      return;
    }

    setResearchState({
      status: "loading",
      message: "Researching company through the configured provider.",
      candidates: [],
    });

    const companyName = optionalTrimmed(draft.company);
    const companyWebsiteUrl = optionalTrimmed(
      draft.normalizedCompanyWebsiteUrl ?? draft.companyWebsiteUrl,
    );
    const jobTitle = optionalTrimmed(draft.jobTitle);
    const jobPostingUrl = optionalTrimmed(
      draft.normalizedJobPostingUrl ?? draft.jobPostingUrl,
    );
    const result = await companyResearch.research({
      ...(companyName === undefined ? {} : { companyName }),
      ...(companyWebsiteUrl === undefined ? {} : { companyWebsiteUrl }),
      ...(jobTitle === undefined ? {} : { jobTitle }),
      ...(jobPostingUrl === undefined ? {} : { jobPostingUrl }),
      requestedAt: nowIso(),
    });

    if (result.ok) {
      updateSourceContext({
        companyResearch: result.value,
        company: result.value.verifiedCompanyName || draft.company,
        companyWebsiteUrl:
          result.value.officialWebsiteUrl ?? draft.companyWebsiteUrl,
        normalizedCompanyWebsiteUrl:
          result.value.officialWebsiteUrl ?? draft.normalizedCompanyWebsiteUrl,
      });
      setResearchState({
        status: "success",
        message:
          "Company research is ready. Review findings before using them for question generation.",
        candidates: [],
      });
      return;
    }

    setResearchState({
      status: result.error.code === "ambiguous-company" ? "ambiguous" : "error",
      message: result.error.message,
      candidates: result.error.candidates ?? [],
    });
  }

  function selectCompanyCandidate(candidate: CompanyResearchCandidate) {
    updateSourceContext({
      company: candidate.name,
      companyWebsiteUrl: candidate.websiteUrl ?? draft.companyWebsiteUrl,
      normalizedCompanyWebsiteUrl:
        candidate.websiteUrl === undefined
          ? draft.normalizedCompanyWebsiteUrl
          : normalizedUrlOrUndefined(candidate.websiteUrl),
    });
    setResearchState({
      status: "idle",
      message: "Company candidate selected. Research again when ready.",
      candidates: [],
    });
  }

  function toggleResearchFinding(findingId: string) {
    if (!draft.companyResearch) {
      return;
    }

    const nextResearch: CompanyResearchSnapshot = {
      ...draft.companyResearch,
      findings: draft.companyResearch.findings.map((finding) =>
        finding.id === findingId
          ? { ...finding, included: !finding.included }
          : finding,
      ),
    };
    updateSourceContext(
      { companyResearch: nextResearch },
      "Question set cleared because company research inclusion changed. Generate again before starting.",
    );
  }

  function deleteCompanyResearch() {
    updateSourceContext(
      { companyResearch: undefined },
      "Question set cleared because company research was removed. Generate again before starting.",
    );
    setResearchState({
      status: "idle",
      message: "Company research deleted from this setup.",
      candidates: [],
    });
  }

  async function handleResumeFileSelection(file: File | undefined) {
    resetResumeFileInput();

    if (!file) {
      pendingResumeFileRef.current = null;
      setResumeImportState({
        status: "idle",
        message:
          draft.resumeText.trim().length > 0
            ? "File selection canceled. The selected résumé was kept."
            : "File selection canceled.",
        preview: null,
      });
      return;
    }

    if (draft.resumeText.trim().length > 0) {
      pendingResumeFileRef.current = file;
      setResumeImportState({
        status: "confirming",
        message: `A résumé is already selected${
          draft.resumeMetadata
            ? ` (${draft.resumeMetadata.originalFilename})`
            : ""
        }. Replace it with ${safeDisplayFilename(file.name)}?`,
        preview: confirmedResumePreview,
      });
      return;
    }

    await importSelectedResumeFile(file);
  }

  async function importSelectedResumeFile(file: File) {
    setResumeImportState({
      status: "loading",
      message: "Extracting résumé text locally.",
      preview: null,
    });

    const result = await importResumeFile(file);
    pendingResumeFileRef.current = null;

    if (result.ok) {
      const preview = createResumePreview(
        result.format,
        result.text,
        createResumeMetadata(file, result.format),
      );
      setResumeImportState({
        status: "success",
        message:
          "Résumé text was extracted locally. Review the preview before using it.",
        preview,
      });
      return;
    }

    setResumeImportState({
      status: "error",
      message: result.failure.message,
      preview: null,
    });
    window.setTimeout(() => resumeImportErrorRef.current?.focus(), 0);
  }

  function confirmResumeReplacement() {
    const file = pendingResumeFileRef.current;
    if (!file) {
      setResumeImportState({
        status: "idle",
        message: "Replacement canceled. The selected résumé was kept.",
        preview: null,
      });
      return;
    }

    void importSelectedResumeFile(file);
  }

  function cancelResumeReplacement() {
    pendingResumeFileRef.current = null;
    setResumeImportState({
      status: "idle",
      message: "Replacement canceled. The selected résumé was kept.",
      preview: null,
    });
  }

  function useSelectedResume() {
    const preview = resumeImportState.preview;
    if (!preview) {
      return;
    }

    const hadGeneratedQuestions = draft.generatedQuestions.length > 0;
    updateDraft(replaceResume(draft, preview.text, preview.metadata));
    setResumeImportState({
      status: "confirmed",
      message: "Résumé selected for question generation.",
      preview,
    });

    if (hadGeneratedQuestions) {
      setQuestionMessage(
        "Question set cleared because résumé context changed. Generate again before starting.",
      );
      setGenerationState("idle");
    }
  }

  function chooseAnotherResumeFile() {
    resumeFileInputRef.current?.click();
  }

  function removeResume() {
    pendingResumeFileRef.current = null;
    const hadGeneratedQuestions = draft.generatedQuestions.length > 0;

    if (draft.resumeText.trim().length > 0 || draft.resumeMetadata) {
      updateDraft(replaceResume(draft, "", undefined));
    }

    setResumeImportState({
      status: "idle",
      message: "Résumé removed. Choose a file to add one.",
      preview: null,
    });

    if (hadGeneratedQuestions) {
      setQuestionMessage(
        "Question set cleared because résumé context changed. Generate again before starting.",
      );
      setGenerationState("idle");
    }
  }

  function resetResumeFileInput() {
    if (resumeFileInputRef.current) {
      resumeFileInputRef.current.value = "";
    }
  }

  async function generateQuestionSet(
    sourceDraft: SetupDraft,
  ): Promise<SetupDraft | null> {
    const setupErrors = validateSetupDraft(sourceDraft);
    const customResult = prepareCustomQuestions(sourceDraft.customQuestions);
    const researchQuestions = researchPracticeQuestions(
      sourceDraft.companyResearch ?? null,
    ).map((text, index) => ({
      clientId: `research-${index + 1}`,
      text,
      order: customResult.questions.length + index,
    }));
    const customErrors = customResult.errors.map((error) => ({
      fieldId: `custom-question-${error.index}`,
      message: error.message,
    }));
    const nextErrors = [...setupErrors, ...customErrors];
    setErrors(nextErrors);

    if (nextErrors.length > 0) {
      window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
      return null;
    }

    const request: QuestionGenerationRequest = {
      sessionId: interviewSessionId("draft-session"),
      context: toInterviewContext(sourceDraft),
      settings: toInterviewSettings(sourceDraft),
      customQuestions: [...customResult.questions, ...researchQuestions],
      excludedNormalizedQuestions: [],
    };

    setGenerationState("generating");

    try {
      const result = await questionProvider.generate(request);
      const nextDraft = {
        ...sourceDraft,
        generatedQuestions: result.questions,
        extractedKeywords: result.extractedKeywords,
        questionSelectionReasons: result.selectionReasons,
      };
      updateDraft(nextDraft);
      setGenerationState("complete");
      setQuestionMessage("Question set generated and snapshotted for review.");
      return nextDraft;
    } catch {
      const result = await createRecoveryQuestionResult(request);
      const nextDraft = {
        ...sourceDraft,
        generatedQuestions: result.questions,
        extractedKeywords: result.extractedKeywords,
        questionSelectionReasons: result.selectionReasons,
      };
      updateDraft(nextDraft);
      setGenerationState("fallback");
      setQuestionMessage(
        "Question provider recovery used safe built-in questions. Setup input was preserved.",
      );
      return nextDraft;
    }
  }

  return (
    <PageContainer className="page-stack setup-page">
      <PageHeader
        eyebrow="Practice setup"
        title="Practice setup"
        lead={
          <p>
            Configure the role, format, timing, optional media, and question
            drafts before device review.
          </p>
        }
      />

      {hasMeaningfulSetupInput(draft) && isDirty ? (
        <Notice title="Unsaved setup changes" variant="warning">
          <p>Your setup input is kept on this page and during device review.</p>
        </Notice>
      ) : null}

      {errors.length > 0 ? (
        <section
          aria-labelledby="setup-error-summary-title"
          className="error-summary"
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
        >
          <h2 id="setup-error-summary-title">Review setup details</h2>
          <ul>
            {errors.map((error) => (
              <li key={`${error.fieldId}-${error.message}`}>
                <a href={`#${error.fieldId}`}>{error.message}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form
        className="setup-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit("devices");
        }}
      >
        <aside className="setup-summary" aria-label="Setup summary">
          <dl>
            <div>
              <dt>Role</dt>
              <dd>{draft.jobTitle.trim() || "Not entered"}</dd>
            </div>
            <div>
              <dt>Questions</dt>
              <dd>{draft.questionCount}</dd>
            </div>
            <div>
              <dt>Timing</dt>
              <dd>{timingLabel(draft)}</dd>
            </div>
            <div>
              <dt>Media</dt>
              <dd>{enabledMediaSummary(draft)}</dd>
            </div>
            <div>
              <dt>Résumé</dt>
              <dd>
                {draft.resumeMetadata
                  ? draft.resumeMetadata.originalFilename
                  : draft.resumeText.trim().length > 0
                    ? "Selected"
                    : "Optional"}
              </dd>
            </div>
          </dl>
        </aside>

        <div className="setup-form__sections">
          <section
            className="form-section"
            aria-labelledby="role-context-title"
          >
            <div className="form-section__heading">
              <h2 id="role-context-title">Role context</h2>
              <p>Required and optional context for local question templates.</p>
            </div>
            <div className="form-grid">
              <TextField
                error={errorByField.get("job-title")}
                help="Used to adapt local question templates."
                id="job-title"
                label="Job title"
                maxLength={120}
                onChange={(value) => {
                  updateDraft({ jobTitle: value });
                }}
                required
                value={draft.jobTitle}
              />
              <TextField
                error={errorByField.get("company")}
                help="Stored only with this local session."
                id="company"
                label="Company name"
                maxLength={120}
                onChange={(value) => {
                  updateSourceContext({ company: value });
                }}
                value={draft.company}
              />
              <TextField
                error={errorByField.get("company-website-url")}
                help="Optional official company website. FairScreen does not guess between similarly named companies."
                id="company-website-url"
                label="Company website URL"
                maxLength={500}
                onChange={(value) => {
                  const normalized = normalizeHttpUrl(value);
                  updateSourceContext({
                    companyWebsiteUrl: value,
                    normalizedCompanyWebsiteUrl: normalized.ok
                      ? normalized.normalizedUrl
                      : undefined,
                  });
                }}
                value={draft.companyWebsiteUrl}
              />
            </div>
            <div className="field-group">
              <TextField
                error={errorByField.get("job-posting-url")}
                help="Optional source URL. Nothing is fetched when you type or paste."
                id="job-posting-url"
                label="Job posting URL"
                maxLength={1_000}
                onChange={(value) => {
                  const normalized = normalizeHttpUrl(value);
                  updateSourceContext({
                    jobPostingUrl: value,
                    normalizedJobPostingUrl: normalized.ok
                      ? normalized.normalizedUrl
                      : undefined,
                  });
                  setJobImportState({
                    status: "idle",
                    message: null,
                    review: null,
                  });
                }}
                value={draft.jobPostingUrl}
              />
              <div className="action-row">
                <Button
                  disabled={
                    !safeJobPostingUrl || jobImportState.status === "loading"
                  }
                  onClick={() => void importCurrentJobPosting()}
                  type="button"
                  variant="secondary"
                >
                  Import job posting
                </Button>
                {safeJobPostingUrl ? (
                  <a
                    className="button button--quiet"
                    href={safeJobPostingUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Open job posting
                  </a>
                ) : null}
                <Button
                  onClick={focusJobDescription}
                  type="button"
                  variant="quiet"
                >
                  Paste job description instead
                </Button>
              </div>
              {jobImportState.message ? (
                <Status
                  tone={jobImportState.status === "error" ? "warning" : "info"}
                >
                  {jobImportState.message}
                </Status>
              ) : null}
              {jobImportState.review ? (
                <JobPostingImportReviewPanel
                  onApply={useImportedJobPosting}
                  review={jobImportState.review}
                />
              ) : null}
            </div>
            <TextAreaField
              error={errorByField.get("job-description")}
              id="job-description"
              label="Job description"
              maxLength={20_000}
              onChange={(value) => {
                updateSourceContext(
                  { jobDescription: value },
                  "Question set cleared because job description changed. Generate again before starting.",
                );
              }}
              rows={8}
              value={draft.jobDescription}
            />
            <CompanyResearchPanel
              onAcceptConsent={() => void acceptResearchConsentAndRun()}
              onDelete={deleteCompanyResearch}
              onRefresh={() => void runCompanyResearch()}
              onRequest={requestCompanyResearch}
              onSelectCandidate={selectCompanyCandidate}
              onToggleFinding={toggleResearchFinding}
              research={draft.companyResearch ?? null}
              state={researchState}
              canResearch={Boolean(
                draft.company.trim() ||
                draft.companyWebsiteUrl.trim() ||
                draft.jobPostingUrl.trim(),
              )}
            />
            <details className="disclosure">
              <summary className="disclosure__summary">
                Résumé file (optional)
              </summary>
              <div className="disclosure__body">
                <div className="resume-import-panel">
                  <div className="field">
                    <label htmlFor="resume-file">Choose résumé file</label>
                    <input
                      accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      aria-describedby={
                        errorByField.has("resume-file")
                          ? "resume-file-help resume-file-error"
                          : "resume-file-help"
                      }
                      aria-invalid={errorByField.has("resume-file")}
                      disabled={resumeImportState.status === "loading"}
                      id="resume-file"
                      onChange={(event) => {
                        void handleResumeFileSelection(
                          event.currentTarget.files?.[0],
                        );
                      }}
                      ref={resumeFileInputRef}
                      type="file"
                    />
                    <p className="field-help" id="resume-file-help">
                      PDF, DOCX, and TXT files up to 5 MiB are processed in this
                      browser and are not uploaded. Extracted plain text is
                      saved only after you review and use it.
                    </p>
                    {errorByField.has("resume-file") ? (
                      <p className="field-error" id="resume-file-error">
                        {errorByField.get("resume-file")}
                      </p>
                    ) : null}
                  </div>
                  {resumeImportState.message ? (
                    resumeImportState.status === "error" ? (
                      <p
                        className="field-error"
                        ref={resumeImportErrorRef}
                        role="alert"
                        tabIndex={-1}
                      >
                        {resumeImportState.message}
                      </p>
                    ) : (
                      <Status
                        tone={
                          resumeImportState.status === "success"
                            ? "success"
                            : "info"
                        }
                      >
                        {resumeImportState.message}
                      </Status>
                    )
                  ) : null}
                  {resumeImportState.status === "confirming" ? (
                    <div
                      aria-label="Replace résumé confirmation"
                      className="action-row"
                      role="group"
                    >
                      <Button
                        onClick={confirmResumeReplacement}
                        type="button"
                        variant="secondary"
                      >
                        Replace résumé
                      </Button>
                      <Button
                        onClick={cancelResumeReplacement}
                        type="button"
                        variant="quiet"
                      >
                        Keep current résumé
                      </Button>
                    </div>
                  ) : null}
                  {visibleResumePreview ? (
                    <ResumeImportPreviewPanel preview={visibleResumePreview} />
                  ) : null}
                  {resumeImportState.status === "success" ||
                  resumeImportState.status === "confirmed" ||
                  visibleResumePreview ? (
                    <div className="action-row">
                      {resumeImportState.status === "success" ? (
                        <Button onClick={useSelectedResume} type="button">
                          Use this résumé
                        </Button>
                      ) : null}
                      <Button
                        onClick={chooseAnotherResumeFile}
                        type="button"
                        variant="secondary"
                      >
                        Choose another file
                      </Button>
                      <Button
                        onClick={removeResume}
                        type="button"
                        variant="quiet"
                      >
                        Remove résumé
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </details>
          </section>

          <section className="form-section" aria-labelledby="format-title">
            <div className="form-section__heading">
              <h2 id="format-title">Practice format</h2>
              <p>Choose the role category, difficulty, and question count.</p>
            </div>
            <SelectField
              id="category"
              label="Category"
              onChange={(value) => {
                updateDraft({ category: value });
              }}
              options={interviewCategoryOptions}
              value={draft.category}
            />
            <RadioGroup
              legend="Difficulty"
              name="difficulty"
              onChange={(value) => {
                updateDraft({ difficulty: value });
              }}
              options={difficultyOptions}
              value={draft.difficulty}
            />
            <NumberField
              error={errorByField.get("question-count")}
              id="question-count"
              label="Questions"
              max={10}
              min={1}
              onChange={(value) => {
                updateDraft({ questionCount: value });
              }}
              value={draft.questionCount}
            />
          </section>

          <section className="form-section" aria-labelledby="timing-title">
            <div className="form-section__heading">
              <h2 id="timing-title">Timing and supports</h2>
              <p>Set preparation time, answer time, and optional coaching.</p>
            </div>
            <div className="form-grid">
              <NumberField
                error={errorByField.get("preparation-time")}
                help="0 to 600 seconds."
                id="preparation-time"
                label="Preparation time"
                max={600}
                min={0}
                onChange={(value) => {
                  updateDraft({ preparationTimeSeconds: value });
                }}
                value={draft.preparationTimeSeconds}
              />
              <NumberField
                error={errorByField.get("answer-time")}
                help="30 to 1200 seconds."
                id="answer-time"
                label="Answer time"
                max={1200}
                min={30}
                onChange={(value) => {
                  updateDraft({ answerTimeSeconds: value });
                }}
                value={draft.answerTimeSeconds}
              />
            </div>
            <RadioGroup
              legend="Timing mode"
              name="timing-mode"
              onChange={(value) => {
                updateDraft({ timingMode: value });
              }}
              options={timingModeOptions}
              value={draft.timingMode}
            />
            <RadioGroup
              legend="Live coaching"
              name="live-coaching"
              onChange={(value) => {
                updateDraft({ liveCoaching: value });
              }}
              options={liveCoachingOptions}
              value={draft.liveCoaching}
            />
          </section>

          <section className="form-section" aria-labelledby="media-title">
            <div className="form-section__heading">
              <h2 id="media-title">Media and transcription</h2>
              <p>
                Choose optional device checks before any permission request.
              </p>
            </div>
            <RadioGroup
              legend="Transcription"
              name="transcription"
              onChange={(value) => {
                updateDraft({
                  transcription: value,
                });
              }}
              options={transcriptionOptions}
              value={draft.transcription}
            />
            <div className="check-grid">
              <label className="check-control">
                <input
                  checked={draft.cameraRequested}
                  onChange={(event) => {
                    updateDraft({
                      cameraRequested: event.target.checked,
                      recordingCaptureRequested:
                        event.target.checked || draft.microphoneRequested
                          ? draft.recordingCaptureRequested
                          : false,
                    });
                  }}
                  type="checkbox"
                />
                <span>Use camera during setup</span>
              </label>
              <label className="check-control">
                <input
                  checked={draft.microphoneRequested}
                  onChange={(event) => {
                    updateDraft({
                      microphoneRequested: event.target.checked,
                      recordingCaptureRequested:
                        event.target.checked || draft.cameraRequested
                          ? draft.recordingCaptureRequested
                          : false,
                    });
                  }}
                  type="checkbox"
                />
                <span>Use microphone during setup</span>
              </label>
              <label className="check-control" id="recording-capture">
                <input
                  aria-describedby={
                    errorByField.has("recording-capture")
                      ? "recording-capture-error"
                      : "recording-capture-help"
                  }
                  aria-invalid={errorByField.has("recording-capture")}
                  checked={draft.recordingCaptureRequested}
                  onChange={(event) => {
                    updateDraft({
                      recordingCaptureRequested: event.target.checked,
                    });
                  }}
                  type="checkbox"
                />
                <span>Recording capture</span>
              </label>
              <p className="field-help" id="recording-capture-help">
                Enabling capture does not save recordings automatically.
              </p>
              {errorByField.has("recording-capture") ? (
                <p className="field-error" id="recording-capture-error">
                  {errorByField.get("recording-capture")}
                </p>
              ) : null}
            </div>
          </section>

          <section className="form-section" aria-labelledby="questions-title">
            <div className="form-section__heading">
              <h2 id="questions-title">Questions</h2>
              <p>Add optional drafts to carry into the local setup snapshot.</p>
            </div>
            <div className="question-draft-list">
              {draft.customQuestions.map((question, index) => (
                <div className="question-editor-row" key={index}>
                  <TextAreaField
                    error={errorByField.get(`custom-question-${index}`)}
                    id={`custom-question-${index}`}
                    label={`Custom question ${index + 1}`}
                    maxLength={500}
                    onChange={(value) => {
                      handleCustomQuestionChange(index, value);
                    }}
                    rows={3}
                    value={question}
                  />
                  <div className="action-row">
                    <Button
                      disabled={index === 0}
                      onClick={() => {
                        updateDraft(
                          moveCustomQuestion(draft, index, index - 1),
                        );
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Move up
                    </Button>
                    <Button
                      disabled={index === draft.customQuestions.length - 1}
                      onClick={() => {
                        updateDraft(
                          moveCustomQuestion(draft, index, index + 1),
                        );
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Move down
                    </Button>
                    <Button
                      onClick={() => {
                        updateDraft(removeCustomQuestion(draft, index));
                      }}
                      type="button"
                      variant="quiet"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              icon={<Plus aria-hidden="true" size={18} />}
              onClick={() => {
                updateDraft(addCustomQuestion(draft));
              }}
              type="button"
              variant="secondary"
            >
              Add question draft
            </Button>
            {draft.generatedQuestions.length > 0 ? (
              <section
                aria-labelledby="question-review-title"
                className="question-review"
              >
                <div className="form-section__heading">
                  <h3 id="question-review-title">Review question set</h3>
                  <p>
                    These questions are snapshotted. Later setup edits will not
                    change this list unless you generate again.
                  </p>
                </div>
                {draft.extractedKeywords.length > 0 ? (
                  <p className="field-help">
                    Local terms used:{" "}
                    {draft.extractedKeywords
                      .slice(0, 5)
                      .map((keyword) => keyword.display)
                      .join(", ")}
                  </p>
                ) : null}
                <ol className="question-review__list">
                  {draft.generatedQuestions.map((question, index) => (
                    <li key={question.id}>
                      <p>{question.text}</p>
                      <p className="field-help">
                        {question.source}; {question.difficulty}
                      </p>
                      <div className="action-row">
                        <Button
                          disabled={index === 0}
                          onClick={() => {
                            const questions = [...draft.generatedQuestions];
                            const [item] = questions.splice(index, 1);
                            if (item) {
                              questions.splice(index - 1, 0, item);
                              updateDraft(
                                replaceGeneratedQuestions(draft, questions),
                              );
                            }
                          }}
                          type="button"
                          variant="secondary"
                        >
                          Move up
                        </Button>
                        <Button
                          disabled={
                            index === draft.generatedQuestions.length - 1
                          }
                          onClick={() => {
                            const questions = [...draft.generatedQuestions];
                            const [item] = questions.splice(index, 1);
                            if (item) {
                              questions.splice(index + 1, 0, item);
                              updateDraft(
                                replaceGeneratedQuestions(draft, questions),
                              );
                            }
                          }}
                          type="button"
                          variant="secondary"
                        >
                          Move down
                        </Button>
                        <Button
                          disabled={draft.generatedQuestions.length <= 1}
                          onClick={() => {
                            updateDraft(
                              replaceGeneratedQuestions(
                                draft,
                                draft.generatedQuestions.filter(
                                  (_, questionIndex) => questionIndex !== index,
                                ),
                              ),
                            );
                          }}
                          type="button"
                          variant="quiet"
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </section>
        </div>

        <div className="form-actions">
          <Button
            disabled={generationState === "generating"}
            icon={<WandSparkles aria-hidden="true" size={18} />}
            onClick={() => {
              void generateQuestionSet(draft);
            }}
            type="button"
            variant="secondary"
          >
            Generate question set
          </Button>
          <Button icon={<Video aria-hidden="true" size={18} />} type="submit">
            Review devices and start
          </Button>
          <Button
            onClick={() => {
              void handleSubmit("no-media");
            }}
            type="button"
            variant="quiet"
          >
            Start without camera or microphone
          </Button>
        </div>
      </form>

      {questionMessage ? <Status tone="info">{questionMessage}</Status> : null}
    </PageContainer>
  );
}

interface TextFieldProps {
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  readonly id: string;
  readonly label: string;
  readonly maxLength: number;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly value: string;
}

function TextField({
  error,
  help,
  id,
  label,
  maxLength,
  onChange,
  required,
  value,
}: TextFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        aria-describedby={describedBy(id, help, error)}
        aria-invalid={Boolean(error)}
        id={id}
        maxLength={maxLength}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        required={required}
        type="text"
        value={value}
      />
      {help ? (
        <p className="field-help" id={`${id}-help`}>
          {help}
        </p>
      ) : null}
      <CharacterCount id={`${id}-count`} maxLength={maxLength} value={value} />
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TextAreaFieldProps {
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  readonly id: string;
  readonly label: string;
  readonly maxLength: number;
  readonly onChange: (value: string) => void;
  readonly rows: number;
  readonly value: string;
}

function TextAreaField({
  error,
  help,
  id,
  label,
  maxLength,
  onChange,
  rows,
  value,
}: TextAreaFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        aria-describedby={describedBy(id, help, error)}
        aria-invalid={Boolean(error)}
        id={id}
        maxLength={maxLength}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        rows={rows}
        value={value}
      />
      {help ? (
        <p className="field-help" id={`${id}-help`}>
          {help}
        </p>
      ) : null}
      <CharacterCount id={`${id}-count`} maxLength={maxLength} value={value} />
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface NumberFieldProps {
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  readonly id: string;
  readonly label: string;
  readonly max: number;
  readonly min: number;
  readonly onChange: (value: number) => void;
  readonly value: number;
}

function NumberField({
  error,
  help,
  id,
  label,
  max,
  min,
  onChange,
  value,
}: NumberFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        aria-describedby={describedBy(id, help, error)}
        aria-invalid={Boolean(error)}
        id={id}
        max={max}
        min={min}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        type="number"
        value={value}
      />
      {help ? (
        <p className="field-help" id={`${id}-help`}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface SelectFieldProps<Value extends string> {
  readonly id: string;
  readonly label: string;
  readonly onChange: (value: Value) => void;
  readonly options: readonly {
    readonly value: Value;
    readonly label: string;
  }[];
  readonly value: Value;
}

function SelectField<Value extends string>({
  id,
  label,
  onChange,
  options,
  value,
}: SelectFieldProps<Value>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        onChange={(event) => {
          onChange(event.target.value as Value);
        }}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface RadioGroupProps<Value extends string> {
  readonly legend: string;
  readonly name: string;
  readonly onChange: (value: Value) => void;
  readonly options: readonly {
    readonly value: Value;
    readonly label: string;
    readonly help?: string;
  }[];
  readonly value: Value;
}

function RadioGroup<Value extends string>({
  legend,
  name,
  onChange,
  options,
  value,
}: RadioGroupProps<Value>) {
  return (
    <fieldset className="radio-group">
      <legend>{legend}</legend>
      <div className="segmented-control">
        {options.map((option) => (
          <label className="segmented-control__item" key={option.value}>
            <input
              checked={option.value === value}
              name={name}
              onChange={() => {
                onChange(option.value);
              }}
              type="radio"
              value={option.value}
            />
            <span>
              <strong>{option.label}</strong>
              {option.help ? <small>{option.help}</small> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CharacterCount({
  id,
  maxLength,
  value,
}: {
  readonly id: string;
  readonly maxLength: number;
  readonly value: string;
}) {
  return (
    <p className="field-help" id={id}>
      {value.length.toLocaleString("en-CA")} /{" "}
      {maxLength.toLocaleString("en-CA")} characters
    </p>
  );
}

function JobPostingImportReviewPanel({
  onApply,
  review,
}: {
  readonly onApply: () => void;
  readonly review: JobPostingImportSnapshot;
}) {
  return (
    <section className="research-panel" aria-labelledby="job-import-title">
      <div className="form-section__heading">
        <h3 id="job-import-title">Review imported job posting</h3>
        <p>
          Imported fields are suggestions. Apply them only if they match the
          posting you intended.
        </p>
      </div>
      <dl className="research-summary">
        <div>
          <dt>Source</dt>
          <dd>
            <a
              href={review.normalizedUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {review.originalUrl}
            </a>
          </dd>
        </div>
        <div>
          <dt>Imported</dt>
          <dd>{formatDateTime(review.importedAt)}</dd>
        </div>
        {review.title ? (
          <div>
            <dt>Title</dt>
            <dd>{review.title}</dd>
          </div>
        ) : null}
        {review.companyName ? (
          <div>
            <dt>Company</dt>
            <dd>{review.companyName}</dd>
          </div>
        ) : null}
        {review.companyWebsiteUrl ? (
          <div>
            <dt>Company website</dt>
            <dd>{review.companyWebsiteUrl}</dd>
          </div>
        ) : null}
        {review.location ? (
          <div>
            <dt>Location</dt>
            <dd>{review.location}</dd>
          </div>
        ) : null}
      </dl>
      {review.description ? (
        <details className="disclosure">
          <summary className="disclosure__summary">
            Preview imported description
          </summary>
          <p>{review.description}</p>
        </details>
      ) : null}
      <Button onClick={onApply} type="button" variant="secondary">
        Use imported fields
      </Button>
    </section>
  );
}

function CompanyResearchPanel({
  canResearch,
  onAcceptConsent,
  onDelete,
  onRefresh,
  onRequest,
  onSelectCandidate,
  onToggleFinding,
  research,
  state,
}: {
  readonly canResearch: boolean;
  readonly onAcceptConsent: () => void;
  readonly onDelete: () => void;
  readonly onRefresh: () => void;
  readonly onRequest: () => void;
  readonly onSelectCandidate: (candidate: CompanyResearchCandidate) => void;
  readonly onToggleFinding: (findingId: string) => void;
  readonly research: CompanyResearchSnapshot | null;
  readonly state: CompanyResearchUiState;
}) {
  return (
    <section
      className="research-panel"
      aria-labelledby="company-research-title"
    >
      <div className="form-section__heading">
        <h3 id="company-research-title">Company research</h3>
        <p>
          Optional. Local practice still works without internet-connected
          research.
        </p>
      </div>
      <div className="action-row">
        <Button
          disabled={!canResearch || state.status === "loading"}
          onClick={onRequest}
          type="button"
          variant="secondary"
        >
          Research company
        </Button>
        {research ? (
          <>
            <Button onClick={onRefresh} type="button" variant="quiet">
              Refresh research
            </Button>
            <Button onClick={onDelete} type="button" variant="quiet">
              Delete research
            </Button>
          </>
        ) : null}
      </div>
      {!canResearch ? (
        <p className="field-help">
          Enter a company name, company website, or job posting URL to enable
          research.
        </p>
      ) : null}
      {state.status === "consent" ? (
        <Notice title="Research consent" variant="privacy">
          <p>
            Company name, company website, job title, and job-posting URL may be
            sent to the configured research service. Resume text/files,
            interview answers, recordings, notes, transcripts, camera data,
            microphone data, and saved sessions are never sent.
          </p>
          <p>
            Research results and sources will be stored locally unless deleted.
          </p>
          <Button onClick={onAcceptConsent} type="button">
            I agree, research company
          </Button>
        </Notice>
      ) : null}
      {state.message ? (
        <Status tone={state.status === "error" ? "warning" : "info"}>
          {state.message}
        </Status>
      ) : null}
      {state.status === "ambiguous" && state.candidates.length > 0 ? (
        <div className="candidate-list" aria-label="Company candidates">
          {state.candidates.map((candidate) => (
            <button
              className="candidate-card"
              key={candidate.id}
              onClick={() => {
                onSelectCandidate(candidate);
              }}
              type="button"
            >
              <strong>{candidate.name}</strong>
              {candidate.websiteUrl ? (
                <span>{candidate.websiteUrl}</span>
              ) : null}
              <small>{candidate.reason}</small>
            </button>
          ))}
        </div>
      ) : null}
      {research ? (
        <div className="research-result">
          <dl className="research-summary">
            <div>
              <dt>Verified company</dt>
              <dd>{research.verifiedCompanyName}</dd>
            </div>
            {research.officialWebsiteUrl ? (
              <div>
                <dt>Official website</dt>
                <dd>
                  <a
                    href={research.officialWebsiteUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {research.officialWebsiteUrl}
                  </a>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Retrieved</dt>
              <dd>{formatDateTime(research.retrievedAt)}</dd>
            </div>
          </dl>
          <p>{research.overview}</p>
          <ul className="research-findings">
            {research.findings.map((finding) => (
              <li key={finding.id}>
                <div className="check-control">
                  <input
                    checked={finding.included}
                    id={`research-finding-${finding.id}`}
                    onChange={() => {
                      onToggleFinding(finding.id);
                    }}
                    type="checkbox"
                  />
                  <label htmlFor={`research-finding-${finding.id}`}>
                    <strong>{finding.label}</strong>
                    <small>{evidenceLabel(finding.evidence)}</small>
                  </label>
                </div>
                <p>{finding.text}</p>
              </li>
            ))}
          </ul>
          {researchPracticeQuestions(research).length > 0 ? (
            <details className="disclosure">
              <summary className="disclosure__summary">
                Company-specific practice questions
              </summary>
              <ul>
                {researchPracticeQuestions(research).map((question) => (
                  <li key={question}>Possible practice question: {question}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <details className="disclosure">
            <summary className="disclosure__summary">Sources</summary>
            <ul>
              {research.sources.map((source, index) => (
                <li key={`${source.url}-${index}`}>
                  <a
                    href={source.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {source.title}
                  </a>{" "}
                  ({source.publisher}; retrieved{" "}
                  {formatDateTime(source.retrievedAt)})
                  <br />
                  Supports: {source.supports.join(", ")}
                </li>
              ))}
            </ul>
          </details>
          {research.limitations.length > 0 ? (
            <Status tone="warning">{research.limitations.join(" ")}</Status>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ResumeImportPreviewPanel({
  preview,
}: {
  readonly preview: ResumeImportPreview;
}) {
  return (
    <section
      aria-labelledby="resume-import-preview-title"
      className="resume-import-preview"
    >
      <div>
        <h3 id="resume-import-preview-title">Extracted résumé preview</h3>
        <p className="field-help">
          Plain text only. Document formatting and embedded content are not
          rendered. Extracted text is retained in setup; the original document
          is not stored.
        </p>
      </div>
      {preview.metadata ? (
        <div className="resume-file-card">
          <strong>{preview.metadata.originalFilename}</strong>
          <span>
            {formatResumeFormat(preview.metadata.format)} •{" "}
            {formatFileSize(preview.metadata.fileSizeBytes)} • Text extracted
            locally • Ready
          </span>
        </div>
      ) : null}
      <dl className="resume-import-metadata">
        <div>
          <dt>File format</dt>
          <dd>{formatResumeFormat(preview.format)}</dd>
        </div>
        <div>
          <dt>Extracted character count</dt>
          <dd>{preview.characterCount.toLocaleString("en-CA")}</dd>
        </div>
      </dl>
      <details className="disclosure resume-preview-disclosure">
        <summary className="disclosure__summary">
          Preview extracted plain text
        </summary>
        <pre
          aria-label="Extracted résumé plain text preview"
          className="resume-preview-text"
        >
          {preview.text}
        </pre>
      </details>
    </section>
  );
}

function createErrorMap(errors: readonly SetupValidationError[]) {
  return new Map(errors.map((error) => [error.fieldId, error.message]));
}

function describedBy(id: string, help: string | undefined, error?: string) {
  return [
    help ? `${id}-help` : null,
    `${id}-count`,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function timingLabel(draft: SetupDraft) {
  const option = timingModeOptions.find(
    (timingMode) => timingMode.value === draft.timingMode,
  );
  return `${option?.label ?? "Flexible"}, ${draft.preparationTimeSeconds}s prep, ${draft.answerTimeSeconds}s answer`;
}

function createResumePreview(
  format: ResumeImportFormat | null,
  text: string,
  metadata?: ResumeMetadata,
): ResumeImportPreview {
  return {
    characterCount: text.length,
    format,
    ...(metadata === undefined ? {} : { metadata }),
    text,
  };
}

function createResumeMetadata(
  file: File,
  format: ResumeImportFormat,
): ResumeMetadata {
  return {
    originalFilename: safeDisplayFilename(file.name),
    format,
    fileSizeBytes: file.size,
    importedAt: nowIso(),
    extractionStatus: "ready",
  };
}

function formatResumeFormat(format: ResumeImportFormat | null): string {
  if (format === null) {
    return "Already selected";
  }

  return format.toUpperCase();
}

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizedUrlOrUndefined(value: string): string | undefined {
  const normalized = normalizeHttpUrl(value);
  return normalized.ok ? normalized.normalizedUrl : undefined;
}

function nowIso() {
  return isoDateTime(new Date().toISOString());
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function evidenceLabel(
  evidence: CompanyResearchSnapshot["findings"][number]["evidence"],
) {
  switch (evidence) {
    case "sourced-fact":
      return "Sourced fact";
    case "inference":
      return "Inference";
    case "anecdotal":
      return "Reported theme, anecdotal";
  }
}
