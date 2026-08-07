import {
  Download,
  FileClock,
  FileText,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  VideoOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useFairScreenRepository } from "../../app/FairScreenRepositoryProvider";
import { isoDateTime } from "../../domain/factories";
import type {
  InterviewSession,
  InterviewSessionStatus,
  QuestionResponse,
} from "../../domain/models";
import type { StorageFailure } from "../../domain/ports";
import { Button } from "../../shared/components/Button";
import { EmptyState } from "../../shared/components/EmptyState";
import { LinkButton } from "../../shared/components/LinkButton";
import { Notice } from "../../shared/components/Notice";
import { PageContainer } from "../../shared/components/PageContainer";
import { PageHeader } from "../../shared/components/PageHeader";
import { Status } from "../../shared/components/Status";
import { createBrowserInterviewProgressStore } from "../interview/progressStore";
import { interviewSessionPath } from "../interview/sessionRoute";
import { useSetupDraft } from "../setup/SetupDraftProvider";
import {
  completedQuestionCount,
  downloadSessionJson,
  effectiveSessionStatus,
  progressFromStoredSession,
  setupDraftFromSession,
} from "./sessionPersistence";

type SavedFilter = "all" | "complete" | "incomplete" | "demo";
type SavedSort =
  "updated-desc" | "updated-asc" | "created-desc" | "job-title-asc";

interface SessionBundle {
  readonly session: InterviewSession;
  readonly responses: readonly QuestionResponse[];
}

export function SavedSessionsPage() {
  const navigate = useNavigate();
  const { replaceDraft } = useSetupDraft();
  const {
    repository,
    status,
    error: repositoryError,
    retry,
  } = useFairScreenRepository();
  const [bundles, setBundles] = useState<readonly SessionBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<StorageFailure>();
  const [filter, setFilter] = useState<SavedFilter>("all");
  const [sort, setSort] = useState<SavedSort>("updated-desc");
  const [searchText, setSearchText] = useState("");
  const [renameId, setRenameId] = useState<string>();
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const [liveMessage, setLiveMessage] = useState("");

  const loadSessions = useCallback(async () => {
    if (status === "opening") return;
    if (status === "unavailable") {
      setLoading(false);
      setFailure(repositoryError);
      return;
    }

    setLoading(true);
    setFailure(undefined);
    const sessions: InterviewSession[] = [];
    let cursor: string | undefined;
    do {
      const result = await repository.listSessions(
        { sort: "updated-desc" },
        { pageSize: 100, ...(cursor ? { cursor } : {}) },
      );
      if (!result.ok) {
        setFailure(result.error);
        setLoading(false);
        return;
      }
      sessions.push(...result.value.values);
      cursor = result.value.nextCursor;
    } while (cursor);

    const loaded = await Promise.all(
      sessions.map(async (session): Promise<SessionBundle> => {
        const responseResult = await repository.listResponses(session.id);
        return {
          session,
          responses: responseResult.ok ? responseResult.value : [],
        };
      }),
    );
    setBundles(loaded);
    setLoading(false);
  }, [repository, repositoryError, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSessions();
    }, 0);
    const handleSavedDataChange = () => {
      void loadSessions();
    };
    window.addEventListener(
      "fairscreen:saved-sessions-changed",
      handleSavedDataChange,
    );
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(
        "fairscreen:saved-sessions-changed",
        handleSavedDataChange,
      );
    };
  }, [loadSessions]);

  const visibleBundles = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    const filtered = bundles.filter(({ session, responses }) => {
      const effectiveStatus = effectiveSessionStatus(session, responses);
      if (filter === "demo" && !session.isDemo) return false;
      if (filter === "complete" && effectiveStatus !== "complete") return false;
      if (
        filter === "incomplete" &&
        !incompleteStatuses.includes(effectiveStatus)
      ) {
        return false;
      }
      if (filter !== "demo" && filter !== "all" && session.isDemo) {
        return false;
      }
      if (!query) return true;
      const haystack = [
        session.displayName,
        session.context.jobTitle,
        session.context.company,
        session.context.jobDescription,
        session.userNotes,
        ...responses.map((response) => response.userNotes),
        ...responses.map(
          (response) => response.transcript.activeRevision?.text,
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return haystack.includes(query);
    });

    return [...filtered].sort((left, right) => {
      switch (sort) {
        case "updated-asc":
          return left.session.updatedAt.localeCompare(right.session.updatedAt);
        case "created-desc":
          return right.session.createdAt.localeCompare(left.session.createdAt);
        case "job-title-asc":
          return displayName(left.session).localeCompare(
            displayName(right.session),
          );
        case "updated-desc":
          return right.session.updatedAt.localeCompare(left.session.updatedAt);
      }
    });
  }, [bundles, filter, searchText, sort]);

  function resume(bundle: SessionBundle) {
    replaceDraft(setupDraftFromSession(bundle.session));
    createBrowserInterviewProgressStore().write(
      progressFromStoredSession(bundle.session, bundle.responses),
    );
    void navigate(interviewSessionPath(bundle.session.id, "practice"));
  }

  function practiceAgain(bundle: SessionBundle) {
    const draft = setupDraftFromSession(bundle.session, { freshSession: true });
    replaceDraft(draft);
    void navigate("/interviews/new");
  }

  async function saveRename(bundle: SessionBundle) {
    const nextName = renameValue.trim();
    setBusyId(String(bundle.session.id));
    const { displayName: previousName, ...sessionWithoutName } = bundle.session;
    void previousName;
    const result = await repository.saveSession({
      ...sessionWithoutName,
      ...(nextName ? { displayName: nextName } : {}),
      updatedAt: isoDateTime(new Date().toISOString()),
    });
    setBusyId(undefined);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setRenameId(undefined);
    setLiveMessage("Session name updated.");
    await loadSessions();
  }

  async function deleteSession(bundle: SessionBundle) {
    setBusyId(String(bundle.session.id));
    const result = await repository.delete({
      kind: "session",
      id: bundle.session.id,
    });
    setBusyId(undefined);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setDeleteId(undefined);
    setLiveMessage("Session and its locally saved data were deleted.");
    await loadSessions();
  }

  async function deleteRecordings(bundle: SessionBundle) {
    const recordingIds = bundle.responses.flatMap((response) =>
      response.recording ? [response.recording.id] : [],
    );
    if (recordingIds.length === 0) return;
    setBusyId(String(bundle.session.id));
    for (const id of recordingIds) {
      const result = await repository.delete({ kind: "recording", id });
      if (!result.ok) {
        setBusyId(undefined);
        setFailure(result.error);
        return;
      }
    }
    setBusyId(undefined);
    setLiveMessage("Saved recording data was deleted. The interview remains.");
    await loadSessions();
  }

  return (
    <PageContainer className="page-stack saved-page">
      <PageHeader
        eyebrow="Local library"
        title="Saved sessions"
        lead={
          <p>
            Resume unfinished practice, review completed answers, export a
            portable copy, or remove local data. Nothing here requires camera or
            microphone access.
          </p>
        }
        actions={
          <LinkButton
            to="/interviews/new"
            icon={<Play aria-hidden="true" size={18} />}
          >
            New practice
          </LinkButton>
        }
      />

      <p aria-live="polite" className="visually-hidden">
        {liveMessage}
      </p>

      {status === "read-only-recovery" ? (
        <Notice title="Saved data opened in recovery mode" variant="warning">
          <p>
            You can review and export records, but this browser database is
            newer than this build and cannot be changed safely.
          </p>
        </Notice>
      ) : null}

      {failure ? (
        <Notice title="Saved sessions could not be opened" variant="error">
          <p>{storageFailureMessage(failure)}</p>
          <div className="action-row">
            <Button
              icon={<RefreshCw aria-hidden="true" size={18} />}
              onClick={() => {
                void retry().then(loadSessions);
              }}
              variant="secondary"
            >
              Try again
            </Button>
          </div>
        </Notice>
      ) : null}

      <section className="saved-toolbar" aria-label="Saved session controls">
        <div className="field saved-search-field">
          <label htmlFor="saved-search">Search saved sessions</label>
          <div className="input-with-icon">
            <Search aria-hidden="true" size={18} />
            <input
              id="saved-search"
              onChange={(event) => {
                setSearchText(event.target.value);
              }}
              placeholder="Job title, company, transcript, or notes"
              type="search"
              value={searchText}
            />
          </div>
        </div>
        <div className="field compact-field">
          <label htmlFor="saved-filter">Show</label>
          <select
            id="saved-filter"
            onChange={(event) => {
              setFilter(event.target.value as SavedFilter);
            }}
            value={filter}
          >
            <option value="all">All sessions</option>
            <option value="complete">Complete</option>
            <option value="incomplete">Incomplete</option>
            <option value="demo">Demo data</option>
          </select>
        </div>
        <div className="field compact-field">
          <label htmlFor="saved-sort">Sort</label>
          <select
            id="saved-sort"
            onChange={(event) => {
              setSort(event.target.value as SavedSort);
            }}
            value={sort}
          >
            <option value="updated-desc">Recently updated</option>
            <option value="updated-asc">Oldest update</option>
            <option value="created-desc">Recently created</option>
            <option value="job-title-asc">Name A–Z</option>
          </select>
        </div>
      </section>

      {loading ? (
        <Status tone="info">Loading saved sessions…</Status>
      ) : bundles.length === 0 && !failure ? (
        <EmptyState
          availability="No completed or unfinished interview records are stored in this browser yet."
          icon={<FileClock aria-hidden="true" size={24} />}
          title="No saved sessions yet"
          actions={
            <LinkButton to="/interviews/new">
              Start a practice interview
            </LinkButton>
          }
        >
          <p>
            FairScreen now saves safe checkpoints locally as you practice.
            Completed and unfinished sessions will appear here.
          </p>
        </EmptyState>
      ) : visibleBundles.length === 0 ? (
        <EmptyState
          availability="The current search and filter combination returned no saved records."
          icon={<Search aria-hidden="true" size={24} />}
          title="No sessions match these controls"
          actions={
            <Button
              onClick={() => {
                setFilter("all");
                setSearchText("");
              }}
              variant="secondary"
            >
              Clear filters
            </Button>
          }
        >
          <p>Try a broader search or show all sessions.</p>
        </EmptyState>
      ) : (
        <section className="saved-session-list" aria-label="Saved sessions">
          {visibleBundles.map((bundle) => {
            const { session, responses } = bundle;
            const recordings = responses.filter(
              (response) => response.recording,
            );
            const completed = completedQuestionCount(responses);
            const effectiveStatus = effectiveSessionStatus(session, responses);
            const isBusy = busyId === String(session.id);
            const isIncomplete = incompleteStatuses.includes(effectiveStatus);
            return (
              <article className="saved-session-card" key={session.id}>
                <div className="saved-session-card__heading">
                  <div>
                    <p className="eyebrow">
                      {categoryLabel(session.context.category)}
                    </p>
                    <h2>{displayName(session)}</h2>
                    {session.displayName ? (
                      <p className="field-help">
                        Role: {session.context.jobTitle}
                      </p>
                    ) : null}
                  </div>
                  <Status
                    tone={
                      effectiveStatus === "complete" ? "success" : "warning"
                    }
                  >
                    {statusLabel(effectiveStatus)}
                  </Status>
                </div>

                <dl className="saved-session-meta">
                  <div>
                    <dt>Progress</dt>
                    <dd>
                      {completed} of {session.questions.length} questions
                    </dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatDateTime(session.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt>Company</dt>
                    <dd>{session.context.company ?? "Not specified"}</dd>
                  </div>
                  <div>
                    <dt>Recordings</dt>
                    <dd>{recordings.length}</dd>
                  </div>
                </dl>

                {renameId === String(session.id) ? (
                  <div className="inline-edit-panel">
                    <div className="field">
                      <label htmlFor={`rename-${session.id}`}>
                        Session name
                      </label>
                      <input
                        id={`rename-${session.id}`}
                        maxLength={160}
                        onChange={(event) => {
                          setRenameValue(event.target.value);
                        }}
                        value={renameValue}
                      />
                    </div>
                    <div className="action-row">
                      <Button
                        disabled={isBusy}
                        onClick={() => void saveRename(bundle)}
                      >
                        Save name
                      </Button>
                      <Button
                        onClick={() => {
                          setRenameId(undefined);
                        }}
                        variant="quiet"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                {deleteId === String(session.id) ? (
                  <Notice title="Delete this saved session?" variant="warning">
                    <p>
                      This removes its responses and saved recordings from this
                      browser. Export first if you need a copy.
                    </p>
                    <div className="action-row">
                      <Button
                        disabled={isBusy}
                        onClick={() => void deleteSession(bundle)}
                        variant="danger"
                      >
                        Delete permanently
                      </Button>
                      <Button
                        onClick={() => {
                          setDeleteId(undefined);
                        }}
                        variant="secondary"
                      >
                        Keep session
                      </Button>
                    </div>
                  </Notice>
                ) : null}

                <div className="action-row saved-session-actions">
                  {isIncomplete ? (
                    <Button
                      disabled={isBusy || status === "read-only-recovery"}
                      icon={<Play aria-hidden="true" size={18} />}
                      onClick={() => {
                        resume(bundle);
                      }}
                    >
                      Resume
                    </Button>
                  ) : (
                    <LinkButton
                      icon={<FileText aria-hidden="true" size={18} />}
                      to={interviewSessionPath(session.id, "report")}
                    >
                      Review
                    </LinkButton>
                  )}
                  {isIncomplete ? (
                    <LinkButton
                      icon={<FileText aria-hidden="true" size={18} />}
                      to={interviewSessionPath(session.id, "report")}
                      variant="secondary"
                    >
                      Review saved work
                    </LinkButton>
                  ) : null}
                  <Button
                    disabled={isBusy}
                    icon={<RotateCcw aria-hidden="true" size={18} />}
                    onClick={() => {
                      practiceAgain(bundle);
                    }}
                    variant="secondary"
                  >
                    Practice again
                  </Button>
                  <Button
                    disabled={isBusy}
                    icon={<Pencil aria-hidden="true" size={18} />}
                    onClick={() => {
                      setRenameId(String(session.id));
                      setRenameValue(
                        session.displayName ?? session.context.jobTitle,
                      );
                    }}
                    variant="quiet"
                  >
                    Rename
                  </Button>
                  <Button
                    disabled={isBusy}
                    icon={<Download aria-hidden="true" size={18} />}
                    onClick={() => {
                      downloadSessionJson(session, responses);
                    }}
                    variant="quiet"
                  >
                    Export JSON
                  </Button>
                  {recordings.length > 0 ? (
                    <Button
                      disabled={isBusy || status === "read-only-recovery"}
                      icon={<VideoOff aria-hidden="true" size={18} />}
                      onClick={() => void deleteRecordings(bundle)}
                      variant="quiet"
                    >
                      Delete recording{recordings.length === 1 ? "" : "s"}
                    </Button>
                  ) : null}
                  <Button
                    disabled={isBusy || status === "read-only-recovery"}
                    icon={<Trash2 aria-hidden="true" size={18} />}
                    onClick={() => {
                      setDeleteId(String(session.id));
                    }}
                    variant="quiet"
                  >
                    Delete
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </PageContainer>
  );
}

const incompleteStatuses: readonly InterviewSessionStatus[] = [
  "draft",
  "ready",
  "in-progress",
  "awaiting-review",
  "ended-early",
  "recovery-required",
];

function displayName(session: InterviewSession): string {
  return session.displayName?.trim() ?? session.context.jobTitle;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: InterviewSessionStatus): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "awaiting-review":
      return "Awaiting review";
    case "in-progress":
      return "In progress";
    case "ended-early":
      return "Ended early";
    case "recovery-required":
      return "Recovery needed";
    case "draft":
      return "Draft";
    case "ready":
      return "Ready";
  }
}

function categoryLabel(
  category: InterviewSession["context"]["category"],
): string {
  return category.replaceAll("-", " ");
}

function storageFailureMessage(failure: StorageFailure): string {
  switch (failure.code) {
    case "blocked":
      return "Another FairScreen tab is blocking the local database. Close older tabs and try again.";
    case "quota-exceeded":
      return "Browser storage is full. Export important sessions, then remove recordings or old sessions.";
    case "record-corrupt":
      return "A saved record could not be validated. FairScreen isolated it instead of guessing at its contents.";
    case "future-version":
      return "This data was created by a newer FairScreen version and can only be opened in recovery mode.";
    case "unavailable":
      return "Persistent browser storage is unavailable. Current practice can continue, but saved sessions cannot survive a reload.";
    case "transaction-aborted":
      return "The browser cancelled the storage operation before it finished.";
    case "not-open":
      return "The local database is not open yet.";
    case "unknown":
      return "The browser reported an unexpected local-storage failure.";
  }
}
