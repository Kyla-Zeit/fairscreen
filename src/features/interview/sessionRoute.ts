import type { InterviewSessionId } from "../../domain/common";

export type InterviewSessionRouteStep = "devices" | "practice" | "report";

export function interviewSessionPath(
  sessionId: InterviewSessionId,
  step: InterviewSessionRouteStep,
) {
  return `/interviews/${encodeURIComponent(String(sessionId))}/${step}`;
}
