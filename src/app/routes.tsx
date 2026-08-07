import type { ReactNode } from "react";
import {
  Accessibility,
  ClipboardCheck,
  FileText,
  LockKeyhole,
  MonitorCheck,
  PanelTop,
  Settings,
  ShieldQuestion,
  Video,
} from "lucide-react";

export type RouteNavGroup = "primary" | "secondary" | "hidden";
export type RouteId =
  | "home"
  | "practice"
  | "device-check"
  | "interview"
  | "report"
  | "saved"
  | "settings"
  | "privacy"
  | "methodology"
  | "accessibility";

export interface AppRouteDefinition {
  readonly id: RouteId;
  readonly path: string;
  readonly href: string;
  readonly label: string;
  readonly navLabel: string;
  readonly title: string;
  readonly documentTitle: string;
  readonly summary: string;
  readonly nav: RouteNavGroup;
  readonly icon: ReactNode;
  readonly activePatterns: readonly string[];
  readonly availability?: string;
  readonly primaryAction?: {
    readonly label: string;
    readonly to: string;
  };
}

export const routeDefinitions: readonly AppRouteDefinition[] = [
  {
    id: "home",
    path: "/",
    href: "/",
    label: "Home",
    navLabel: "Home",
    title: "Practice the interview. Question the scoring.",
    documentTitle: "Home",
    summary:
      "Privacy-focused interview practice with local coaching and optional media analysis.",
    nav: "hidden",
    icon: <PanelTop aria-hidden="true" size={22} />,
    activePatterns: ["/"],
  },
  {
    id: "practice",
    path: "/interviews/new",
    href: "/interviews/new",
    label: "Practice setup",
    navLabel: "Practice",
    title: "Practice setup",
    documentTitle: "Practice setup",
    summary:
      "Configure a role, question set, timing, and optional media choices before starting a practice interview.",
    nav: "primary",
    icon: <Video aria-hidden="true" size={22} />,
    activePatterns: ["/interviews/*"],
    primaryAction: {
      label: "Review devices and start",
      to: "/interviews/new",
    },
  },
  {
    id: "device-check",
    path: "/interviews/:sessionId/devices",
    href: "/interviews/example/devices",
    label: "Device Check",
    navLabel: "Device Check",
    title: "Device check",
    documentTitle: "Device check",
    summary:
      "Review browser support and optional camera or microphone choices after a practice session is created.",
    nav: "hidden",
    icon: <MonitorCheck aria-hidden="true" size={22} />,
    activePatterns: ["/interviews/*"],
    primaryAction: {
      label: "Change setup",
      to: "/interviews/new",
    },
  },
  {
    id: "interview",
    path: "/interviews/:sessionId/practice",
    href: "/interviews/example/practice",
    label: "Interview",
    navLabel: "Interview",
    title: "Interview practice",
    documentTitle: "Interview practice",
    summary:
      "Answer practice questions with optional timing, reviewed transcripts, coaching prompts, and user-chosen media settings.",
    nav: "hidden",
    icon: <PanelTop aria-hidden="true" size={22} />,
    activePatterns: ["/interviews/*"],
    availability:
      "The interview workspace saves safe local checkpoints after setup creates a practice session. Reviewed transcription, coaching, and saved reports are available.",
    primaryAction: {
      label: "Explore accessibility options",
      to: "/accessibility",
    },
  },
  {
    id: "report",
    path: "/interviews/:sessionId/report",
    href: "/interviews/example/report",
    label: "Report",
    navLabel: "Report",
    title: "Practice report",
    documentTitle: "Practice report",
    summary:
      "Review answer-content coaching separately from optional audio and video-call condition observations.",
    nav: "hidden",
    icon: <ClipboardCheck aria-hidden="true" size={22} />,
    activePatterns: ["/interviews/*"],
    availability:
      "Saved reports show answer content before separate optional delivery and video-call condition observations. FairScreen does not combine them into a single score.",
    primaryAction: {
      label: "See what FairScreen refuses to infer",
      to: "/methodology",
    },
  },
  {
    id: "saved",
    path: "/saved",
    href: "/saved",
    label: "Saved Sessions",
    navLabel: "Saved",
    title: "Saved sessions",
    documentTitle: "Saved sessions",
    summary:
      "Resume, review, rename, export, or delete interviews and user-saved recordings stored locally in this browser.",
    nav: "primary",
    icon: <FileText aria-hidden="true" size={22} />,
    activePatterns: ["/saved"],
    availability:
      "Saved Sessions reads local IndexedDB records and provides Resume, Review, Practice again, Rename, Delete, Export, and Delete recording actions.",
    primaryAction: {
      label: "Return to the start page",
      to: "/",
    },
  },
  {
    id: "privacy",
    path: "/privacy",
    href: "/privacy",
    label: "Privacy",
    navLabel: "Privacy",
    title: "Your practice data stays under your control",
    documentTitle: "Privacy",
    summary:
      "Understand what runs locally, what is never stored, and where browser limitations still matter.",
    nav: "secondary",
    icon: <LockKeyhole aria-hidden="true" size={22} />,
    activePatterns: ["/privacy"],
  },
  {
    id: "methodology",
    path: "/methodology",
    href: "/methodology",
    label: "Methodology",
    navLabel: "Methodology",
    title: "Methodology and limits",
    documentTitle: "Methodology",
    summary:
      "Review how FairScreen keeps answer coaching separate from observable video-call conditions.",
    nav: "secondary",
    icon: <ShieldQuestion aria-hidden="true" size={22} />,
    activePatterns: ["/methodology"],
  },
  {
    id: "accessibility",
    path: "/accessibility",
    href: "/accessibility",
    label: "Accessibility",
    navLabel: "Accessibility",
    title: "Accessibility and alternatives",
    documentTitle: "Accessibility",
    summary:
      "FairScreen is designed around keyboard access, timing control, reviewed transcripts, and camera-optional use.",
    nav: "secondary",
    icon: <Accessibility aria-hidden="true" size={22} />,
    activePatterns: ["/accessibility"],
  },
  {
    id: "settings",
    path: "/settings",
    href: "/settings",
    label: "Settings",
    navLabel: "Settings",
    title: "Settings",
    documentTitle: "Settings",
    summary:
      "Adjust timing, accessibility, privacy, storage, and optional media preferences for future practice sessions.",
    nav: "secondary",
    icon: <Settings aria-hidden="true" size={22} />,
    activePatterns: ["/settings"],
    availability:
      "Settings stores future-practice preferences locally and provides storage summaries, reset controls, and confirmed deletion of saved browser data.",
    primaryAction: {
      label: "Review accessibility options",
      to: "/accessibility",
    },
  },
];

export const notFoundTitle = "That FairScreen page was not found";
