import {
  ArrowLeft,
  Download,
  FileJson,
  FileText,
  Play,
  RotateCcw,
  Save,
  Video,
  VideoOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useFairScreenRepository } from "../../app/FairScreenRepositoryProvider";
import type {
  InterviewSession,
  QuestionResponse,
  RecordingReference,
} from "../../domain/models";
import { interviewSessionId, isoDateTime } from "../../domain/factories";
import type { StorageFailure } from "../../domain/ports";
import { getBrowserRecording } from "../../infrastructure/browser/recordingStorage";
import { Button } from "../../shared/components/Button";
import { EmptyState } from "../../shared/components/EmptyState";
import { LinkButton } from "../../shared/components/LinkButton";
import { Notice } from "../../shared/components/Notice";
import { PageContainer } from "../../shared/components/PageContainer";
import { PageHeader } from "../../shared/components/PageHeader";
import { Status } from "../../shared/components/Status";
import { createDeterministicAnswerAnalyzer } from "../analysis/DeterministicAnswerAnalyzer";
import { createBrowserInterviewProgressStore } from "../interview/progressStore";
import { interviewSessionPath } from "../interview/sessionRoute";
import { useSetupDraft } from "../setup/SetupDraftProvider";
import {
  downloadSessionJson,
  downloadSessionText,
  effectiveSessionStatus,
  progressFromStoredSession,
  setupDraftFromSession,
} from "../sessions/sessionPersistence";

const reportAnswerAnalyzer = createDeterministicAnswerAnalyzer();

export function SavedSessionReportPage() {
  const params = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { replaceDraft } = useSetupDraft();
  const { repository, status } = useFairScreenRepository();
  const [session, setSession] = useState<InterviewSession>();
  const [responses, setResponses] = useState<readonly QuestionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<StorageFailure>();
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");

  const load = useCallback(async () => {
    if (status === "opening") return;
    if (status === "unavailable" || !params.sessionId) {
      setLoading(false);
      return;
    }

    let id;
    try {
      id = interviewSessionId(decodeURIComponent(params.sessionId));
    } catch {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [sessionResult, responseResult] = await Promise.all([
      repository.getSession(id),
      repository.listResponses(id),
    ]);
    if (!sessionResult.ok) {
      setFailure(sessionResult.error);
      setLoading(false);
      return;
    }
    if (!responseResult.ok) {
      setFailure(responseResult.error);
      setLoading(false);
      return;
    }
    setSession(sessionResult.value ?? undefined);
    setResponses(responseResult.value);
    setNotes(sessionResult.value?.userNotes ?? "");
    setLoading(false);
  }, [params.sessionId, repository, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [load]);

  const selectedResponses = useMemo(() => {
    if (!session) return new Map<string, QuestionResponse>();
    const selected = new Map<string, QuestionResponse>();
    for (const question of session.questions) {
      const attempts = responses
        .filter((response) => response.question.id === question.id)
        .sort((left, right) => left.attemptNumber - right.attemptNumber);
      const selectedId = session.selectedAttemptByQuestion[question.id];
      const selectedAttempt =
        attempts.find((attempt) => attempt.id === selectedId) ??
        attempts.at(-1);
      if (selectedAttempt) {
        selected.set(question.id, selectedAttempt);
      }
    }
    return selected;
  }, [responses, session]);

  function resumePractice() {
    if (!session) return;
    replaceDraft(setupDraftFromSession(session));
    createBrowserInterviewProgressStore().write(
      progressFromStoredSession(session, responses),
    );
    void navigate(interviewSessionPath(session.id, "practice"));
  }

  function practiceAgain() {
    if (!session) return;
    replaceDraft(setupDraftFromSession(session, { freshSession: true }));
    void navigate("/interviews/new");
  }

  async function saveSessionNotes() {
    if (!session) return;
    setSavingNotes(true);
    const { userNotes: previousNotes, ...sessionWithoutNotes } = session;
    void previousNotes;
    const updated: InterviewSession = {
      ...sessionWithoutNotes,
      ...(notes.trim() ? { userNotes: notes.trim() } : {}),
      updatedAt: isoDateTime(new Date().toISOString()),
    };
    const result = await repository.saveSession(updated);
    setSavingNotes(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setSession(updated);
    setLiveMessage("Session notes saved.");
  }

  async function deleteRecording(recording: RecordingReference) {
    const result = await repository.delete({
      kind: "recording",
      id: recording.id,
    });
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setLiveMessage("Recording deleted. The response and report remain.");
    await load();
  }

  if (loading) {
    return (
      <PageContainer className="page-stack">
        <PageHeader
          eyebrow="Saved practice"
          title="Practice report"
          lead={
            <p>
              Loading the locally saved session without requesting camera or
              microphone access.
            </p>
          }
        />
        <Status tone="info">Loading saved report…</Status>
      </PageContainer>
    );
  }

  if (!session) {
    return (
      <PageContainer className="page-stack">
        <PageHeader
          eyebrow="Saved practice"
          title="Practice report"
          lead={<p>Review a locally saved FairScreen interview report.</p>}
        />
        <EmptyState
          availability="No local session record matched this report address."
          icon={<FileText aria-hidden="true" size={24} />}
          title="Saved report not found"
          actions={<LinkButton to="/saved">Return to Saved</LinkButton>}
        >
          <p>
            This session may have been deleted, was created in another browser,
            or could not be opened from local storage.
          </p>
        </EmptyState>
      </PageContainer>
    );
  }

  const displayStatus = effectiveSessionStatus(session, responses);
  const isComplete = displayStatus === "complete";
  const answeredQuestions = new Set(
    responses.map((response) => response.question.id),
  ).size;

  return (
    <PageContainer className="page-stack report-page">
      <PageHeader
        eyebrow={isComplete ? "Completed practice" : "Saved checkpoint"}
        title={session.displayName ?? session.context.jobTitle}
        lead={
          <p>
            Answer-content coaching appears before optional delivery and video
            conditions. FairScreen does not combine them into a score or hiring
            judgment.
          </p>
        }
        actions={
          <>
            <LinkButton
              icon={<ArrowLeft aria-hidden="true" size={18} />}
              to="/saved"
              variant="secondary"
            >
              Saved sessions
            </LinkButton>
            {!isComplete ? (
              <Button
                icon={<Play aria-hidden="true" size={18} />}
                onClick={resumePractice}
              >
                Resume practice
              </Button>
            ) : null}
          </>
        }
      />

      <p aria-live="polite" className="visually-hidden">
        {liveMessage}
      </p>

      {failure ? (
        <Notice title="A local data action failed" variant="error">
          <p>
            {failure.code.replaceAll("-", " ")} during {failure.operation}.
          </p>
        </Notice>
      ) : null}

      <section
        className="report-overview"
        aria-labelledby="report-overview-title"
      >
        <div className="section-heading">
          <h2 id="report-overview-title">Report overview</h2>
          <p>
            {answeredQuestions} of {session.questions.length} questions have
            saved attempts. Missing or partial measurements remain labelled as
            unavailable rather than being turned into zeros.
          </p>
        </div>
        <dl className="saved-session-meta report-summary-grid">
          <div>
            <dt>Status</dt>
            <dd>{displayStatus.replaceAll("-", " ")}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{session.context.jobTitle}</dd>
          </div>
          <div>
            <dt>Company</dt>
            <dd>{session.context.company ?? "Not specified"}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{formatDateTime(session.updatedAt)}</dd>
          </div>
        </dl>
        <div className="action-row">
          <Button
            icon={<FileJson aria-hidden="true" size={18} />}
            onClick={() => {
              downloadSessionJson(session, responses);
            }}
            variant="secondary"
          >
            Export JSON
          </Button>
          <Button
            icon={<Download aria-hidden="true" size={18} />}
            onClick={() => {
              downloadSessionText(session, responses);
            }}
            variant="secondary"
          >
            Export text
          </Button>
          <Button
            icon={<RotateCcw aria-hidden="true" size={18} />}
            onClick={practiceAgain}
            variant="quiet"
          >
            Practice again
          </Button>
        </div>
      </section>

      <section className="section-block" aria-labelledby="session-notes-title">
        <div className="section-heading">
          <h2 id="session-notes-title">Session notes</h2>
          <p>
            These notes stay in this browser unless you explicitly export them.
          </p>
        </div>
        <div className="field">
          <label htmlFor="session-notes">Private notes</label>
          <textarea
            id="session-notes"
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            rows={5}
            value={notes}
          />
        </div>
        <div className="action-row">
          <Button
            disabled={savingNotes || status === "read-only-recovery"}
            icon={<Save aria-hidden="true" size={18} />}
            onClick={() => void saveSessionNotes()}
          >
            {savingNotes ? "Saving…" : "Save notes"}
          </Button>
        </div>
      </section>

      <section className="report-question-list" aria-label="Question reports">
        {session.questions.map((question, index) => {
          const attempts = responses
            .filter((response) => response.question.id === question.id)
            .sort((left, right) => left.attemptNumber - right.attemptNumber);
          const selected = selectedResponses.get(question.id);
          return (
            <article className="report-question-card" key={question.id}>
              <div className="section-heading">
                <p className="eyebrow">Question {index + 1}</p>
                <h2>{question.text}</h2>
                <p>
                  {attempts.length === 0
                    ? "No saved attempt."
                    : `${attempts.length} saved attempt${attempts.length === 1 ? "" : "s"}. Showing attempt ${selected?.attemptNumber ?? attempts.at(-1)?.attemptNumber}.`}
                </p>
              </div>

              {attempts.length > 1 ? (
                <div className="field compact-field">
                  <label htmlFor={`attempt-${question.id}`}>
                    Display attempt
                  </label>
                  <select
                    id={`attempt-${question.id}`}
                    onChange={(event) => {
                      const response = attempts.find(
                        (attempt) => String(attempt.id) === event.target.value,
                      );
                      if (!response) return;
                      void repository
                        .saveSession({
                          ...session,
                          selectedAttemptByQuestion: {
                            ...session.selectedAttemptByQuestion,
                            [question.id]: response.id,
                          },
                          updatedAt: isoDateTime(new Date().toISOString()),
                        })
                        .then(load);
                    }}
                    value={selected?.id ?? attempts.at(-1)?.id}
                  >
                    {attempts.map((attempt) => (
                      <option key={attempt.id} value={attempt.id}>
                        Attempt {attempt.attemptNumber} · {attempt.status}
                      </option>
                    ))}
                  </select>
                  <p className="field-help">
                    FairScreen does not choose a “best” retry. You select which
                    attempt the report displays.
                  </p>
                </div>
              ) : null}

              {selected ? (
                <AttemptReport
                  context={session.context}
                  response={selected}
                  onDeleteRecording={deleteRecording}
                />
              ) : (
                <Notice title="No response saved" variant="info">
                  <p>Resume this practice session to answer the question.</p>
                </Notice>
              )}
            </article>
          );
        })}
      </section>
    </PageContainer>
  );
}

function AttemptReport({
  context,
  response,
  onDeleteRecording,
}: {
  readonly context: InterviewSession["context"];
  readonly response: QuestionResponse;
  readonly onDeleteRecording: (recording: RecordingReference) => Promise<void>;
}) {
  const transcript = response.transcript.activeRevision;
  const speakingMetric = response.audioMetrics?.speakingDurationMs;
  const coaching = transcript
    ? reportAnswerAnalyzer.analyzePractice({
        question: response.question,
        transcriptRevision: transcript,
        locale: context.locale,
        ...(response.answerDurationMs !== undefined
          ? { answerDurationMs: response.answerDurationMs }
          : {}),
        ...(speakingMetric && speakingMetric.status !== "unavailable"
          ? { speakingDurationMs: speakingMetric.value }
          : {}),
        context,
        ...(response.audioMetrics
          ? { audioMetrics: response.audioMetrics }
          : {}),
      })
    : undefined;
  const analysis = coaching?.analysis ?? response.analysis;
  const answerNotes = response.userNotes?.trim();
  const showAnswerNotes =
    Boolean(answerNotes) &&
    (!transcript || !sameReadableText(answerNotes ?? "", transcript.text));
  return (
    <div className="attempt-report">
      <section
        className="report-content-section"
        aria-labelledby={`content-${response.id}`}
      >
        <div className="section-heading">
          <h3 id={`content-${response.id}`}>Answer content</h3>
          <p>
            Coaching below uses the reviewed transcript. It does not use face,
            gaze, expression, appearance, or other visual traits.
          </p>
        </div>
        {transcript ? (
          <div className="transcript-panel">
            <h4>Reviewed transcript</h4>
            <ParagraphText text={transcript.text} />
          </div>
        ) : (
          <Status tone="info">Reviewed transcript not available</Status>
        )}

        {coaching && coaching.status !== "transcript-required" ? (
          <div className="coaching-report">
            <div className="practice-takeaway">
              <h4>Overall practice takeaway</h4>
              <p>{coaching.overallTakeaway}</p>
            </div>
            <div className="report-two-column">
              <div className="info-card">
                <h4>What worked</h4>
                {coaching.whatWorked.length > 0 ? (
                  <ul>
                    {coaching.whatWorked.map((strength) => (
                      <li key={strength}>{strength}</li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    No reliable strength cue was available from the transcript.
                  </p>
                )}
              </div>
              <div className="info-card">
                <h4>What to improve</h4>
                {coaching.whatToImprove.length > 0 ? (
                  <ul>
                    {coaching.whatToImprove.map((suggestion) => (
                      <li key={suggestion}>{suggestion}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No specific improvement was generated.</p>
                )}
              </div>
            </div>
            <div className="info-card stronger-answer-card">
              <h4>Suggested stronger answer</h4>
              <ParagraphText text={coaching.suggestedStrongerAnswer} />
              <p className="field-help">
                Practice revision based on the reviewed transcript. Verify and
                personalize it before using it in an interview.
              </p>
            </div>
            {analysis ? (
              <details className="disclosure">
                <summary className="disclosure__summary">
                  Detailed content categories
                </summary>
                <div className="disclosure__body report-category-list">
                  {analysis.categories.map((category) => (
                    <div className="report-category-row" key={category.id}>
                      <strong>{category.label}</strong>
                      <Status tone={ratingTone(category.rating)}>
                        {category.rating
                          .replaceAll(/([A-Z])/g, " $1")
                          .toLowerCase()}
                      </Status>
                      <p>{category.summary}</p>
                      {category.suggestion ? (
                        <p>{category.suggestion}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : (
          <Status tone="info">
            Content coaching was not generated because no reviewed transcript
            was saved for this attempt.
          </Status>
        )}

        {showAnswerNotes && answerNotes ? (
          <div className="notes-panel">
            <h4>Answer notes</h4>
            <ParagraphText text={answerNotes} />
          </div>
        ) : null}
      </section>

      <details className="technical-details">
        <summary>Optional microphone and camera observations</summary>
        <div className="technical-details__body report-two-column">
          <AudioReport response={response} />
          <VideoReport response={response} />
        </div>
      </details>

      {response.recording ? (
        <SavedRecordingPlayer
          recording={response.recording}
          onDelete={onDeleteRecording}
        />
      ) : null}
    </div>
  );
}

function sameReadableText(left: string, right: string): boolean {
  const normalize = (value: string) =>
    value.trim().replaceAll(/\s+/g, " ").toLocaleLowerCase("en-CA");
  return normalize(left) === normalize(right);
}

function ParagraphText({ text }: { readonly text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return (
    <div className="paragraph-text">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}:${paragraph.slice(0, 32)}`}>{paragraph}</p>
      ))}
    </div>
  );
}

function AudioReport({ response }: { readonly response: QuestionResponse }) {
  const metrics = response.audioMetrics;
  return (
    <section className="info-card">
      <h4>Audio timing</h4>
      {!metrics || metrics.status === "unavailable" ? (
        <p>
          No microphone-based delivery observations were saved for this attempt.
        </p>
      ) : (
        <dl className="metric-list">
          <MetricRow
            label="Answer duration"
            value={formatMillisecondsMetric(metrics.answerDurationMs)}
          />
          <MetricRow
            label="Approximate speaking pace"
            value={formatNumberMetric(
              metrics.approximateWordsPerMinute,
              " wpm",
            )}
          />
          <MetricRow
            label="Longest internal silence"
            value={formatMillisecondsMetric(metrics.longestInternalSilenceMs)}
          />
        </dl>
      )}
      {metrics?.warnings.length ? (
        <p className="field-help">Limits: {metrics.warnings.join(", ")}.</p>
      ) : null}
    </section>
  );
}

function VideoReport({ response }: { readonly response: QuestionResponse }) {
  const metrics = response.videoMetrics;
  return (
    <section className="info-card">
      <h4>Video-call conditions</h4>
      {!metrics || metrics.status === "unavailable" ? (
        <p>
          No camera-based video-call observations were saved for this attempt.
        </p>
      ) : (
        <dl className="metric-list">
          <MetricRow
            label="Face detected"
            value={formatNumberMetric(metrics.faceDetectionPercentage, "%")}
          />
          <MetricRow
            label="Reasonable centring"
            value={formatNumberMetric(
              metrics.reasonableCentringPercentage,
              "%",
            )}
          />
          <MetricRow
            label="Near-camera orientation"
            value={formatNumberMetric(
              metrics.nearCameraOrientationPercentage,
              "%",
            )}
          />
          <MetricRow
            label="Framing"
            value={formatDistributionMetric(metrics.framing)}
          />
          <MetricRow
            label="Brightness"
            value={formatDistributionMetric(metrics.brightness)}
          />
        </dl>
      )}
      <p className="field-help">
        These are observable call conditions, not competence, honesty,
        confidence, emotion, attention, or employability.
      </p>
    </section>
  );
}

function SavedRecordingPlayer({
  recording,
  onDelete,
}: {
  readonly recording: RecordingReference;
  readonly onDelete: (recording: RecordingReference) => Promise<void>;
}) {
  const [url, setUrl] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  async function loadRecording() {
    setLoading(true);
    setError("");
    const result = await getBrowserRecording(recording.id);
    setLoading(false);
    if (!result.ok || !result.value) {
      setError("The saved recording could not be loaded from this browser.");
      return;
    }
    if (url) URL.revokeObjectURL(url);
    setUrl(URL.createObjectURL(result.value.blob));
  }

  return (
    <section
      className="saved-recording-panel"
      aria-labelledby={`recording-${recording.id}`}
    >
      <div className="section-heading">
        <h3 id={`recording-${recording.id}`}>User-saved recording</h3>
        <p>
          Stored only because it was explicitly saved. It is excluded from text
          and JSON exports.
        </p>
      </div>
      {url ? (
        recording.mimeType.startsWith("video/") ? (
          <video className="saved-recording-media" controls src={url}>
            <track kind="captions" />
          </video>
        ) : (
          <audio className="saved-recording-media" controls src={url}>
            <track kind="captions" />
          </audio>
        )
      ) : null}
      {error ? <Status tone="error">{error}</Status> : null}
      <div className="action-row">
        <Button
          disabled={loading}
          icon={<Video aria-hidden="true" size={18} />}
          onClick={() => void loadRecording()}
          variant="secondary"
        >
          {loading ? "Loading…" : url ? "Reload recording" : "Load recording"}
        </Button>
        <Button
          icon={<VideoOff aria-hidden="true" size={18} />}
          onClick={() => void onDelete(recording)}
          variant="danger"
        >
          Delete recording
        </Button>
      </div>
    </section>
  );
}

function MetricRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatMillisecondsMetric(metric: {
  readonly status: string;
  readonly value?: number;
}): string {
  if (metric.status === "unavailable" || metric.value === undefined) {
    return "Not available";
  }
  return `${(metric.value / 1000).toFixed(1)} seconds${metric.status === "partial" ? " (partial)" : ""}`;
}

function formatNumberMetric(
  metric: { readonly status: string; readonly value?: number },
  suffix: string,
): string {
  if (metric.status === "unavailable" || metric.value === undefined) {
    return "Not available";
  }
  return `${metric.value.toFixed(1)}${suffix}${metric.status === "partial" ? " (partial)" : ""}`;
}

function formatDistributionMetric(metric: {
  readonly status: string;
  readonly value?: { readonly dominant: string };
}): string {
  if (metric.status === "unavailable" || !metric.value) return "Not available";
  return `${metric.value.dominant.replaceAll("-", " ")}${metric.status === "partial" ? " (partial)" : ""}`;
}

function ratingTone(rating: string): "success" | "warning" | "info" {
  if (rating === "strong") return "success";
  if (rating === "developing" || rating === "needsMoreEvidence")
    return "warning";
  return "info";
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
