import type { InterviewSession, QuestionResponse } from "./models";
import type { PageRequest, PageResult, SessionSearchQuery } from "./ports";

const punctuationPattern = /[\p{P}\p{S}]+/gu;
const whitespacePattern = /\s+/g;

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replaceAll(punctuationPattern, " ")
    .replaceAll(whitespacePattern, " ")
    .trim();
}

export function sessionMatchesSearch(
  session: InterviewSession,
  responses: readonly QuestionResponse[],
  text: string,
): boolean {
  const query = normalizeSearchText(text);
  if (!query) {
    return true;
  }

  const allowedText = [
    session.context.jobTitle,
    session.context.company ?? "",
    session.userNotes ?? "",
    ...session.questions.map((question) => question.text),
    ...responses
      .filter((response) => response.sessionId === session.id)
      .map((response) => response.userNotes ?? ""),
  ]
    .map(normalizeSearchText)
    .join(" ");

  return query.split(" ").every((term) => allowedText.includes(term));
}

export function filterAndPageSessions(
  sessions: readonly InterviewSession[],
  responses: readonly QuestionResponse[],
  query: SessionSearchQuery,
  page: PageRequest,
): PageResult<InterviewSession> {
  const filtered = sessions.filter((session) => {
    if (query.statuses && !query.statuses.includes(session.status)) {
      return false;
    }
    if (
      query.categories &&
      !query.categories.includes(session.context.category)
    ) {
      return false;
    }
    if (query.createdAfter && session.createdAt < query.createdAfter) {
      return false;
    }
    if (query.createdBefore && session.createdAt > query.createdBefore) {
      return false;
    }
    if (query.isDemo !== undefined && session.isDemo !== query.isDemo) {
      return false;
    }

    const sessionResponses = responses.filter(
      (response) => response.sessionId === session.id,
    );
    if (
      query.includesSavedRecording !== undefined &&
      sessionResponses.some((response) => Boolean(response.recording)) !==
        query.includesSavedRecording
    ) {
      return false;
    }

    return sessionMatchesSearch(session, sessionResponses, query.text ?? "");
  });

  const sorted = [...filtered].sort((left, right) => {
    switch (query.sort) {
      case "updated-asc":
        return left.updatedAt.localeCompare(right.updatedAt);
      case "created-desc":
        return right.createdAt.localeCompare(left.createdAt);
      case "job-title-asc":
        return normalizeSearchText(left.context.jobTitle).localeCompare(
          normalizeSearchText(right.context.jobTitle),
        );
      case "updated-desc":
        return right.updatedAt.localeCompare(left.updatedAt);
    }
  });

  const safePageSize = Math.min(Math.max(page.pageSize, 1), 100);
  const start = parseCursor(page.cursor);
  const values = sorted.slice(start, start + safePageSize);
  const nextOffset = start + values.length;

  return nextOffset < sorted.length
    ? { values, nextCursor: `offset:${nextOffset}` }
    : { values };
}

function parseCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }
  const match = /^offset:(\d+)$/.exec(cursor);
  if (!match) {
    return 0;
  }
  return Number(match[1]);
}
