import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  createBrowserMicrophoneLevelMonitor,
  type MicrophoneLevelMonitor,
} from "../infrastructure/browser/audioLevels";
import {
  createBrowserCapabilityService,
  type BrowserCapabilityService,
} from "../infrastructure/browser/capabilities";
import {
  createBrowserMediaDeviceService,
  type MediaDevicePort,
} from "../infrastructure/browser/mediaDevices";
import {
  startMediaRecorderSession,
  type MediaRecorderStartResult,
} from "../infrastructure/browser/mediaRecorder";
import { saveBrowserRecordingAfterUserChoice } from "../infrastructure/browser/recordingStorage";
import { createBrowserSpeechRecognitionProvider } from "../infrastructure/browser/speechRecognition";
import {
  createBrowserResumeFileImportService,
  type ResumeFileImportService,
} from "../infrastructure/browser/resumeFileImport";
import {
  createUnavailableCompanyResearchProvider,
  createUnavailableJobPostingImportService,
  type CompanyResearchProvider,
  type JobPostingImportService,
} from "../features/setup/jobContext";
import {
  startWebAudioMetricSession,
  type WebAudioAnalyzerInput,
  type WebAudioAnalyzerStartResult,
} from "../infrastructure/browser/webAudioAnalyzer";
import {
  startBrowserVideoAnalysisSession,
  type VideoAnalysisInput,
  type VideoAnalysisStartResult,
} from "../infrastructure/browser/videoAnalysisClient";
import type { RecordingReference } from "../domain/models";
import type { StorageResult, TranscriptionProvider } from "../domain/ports";
import {
  createDeterministicAnswerAnalyzer,
  type PracticeAnswerAnalyzer,
} from "../features/analysis/DeterministicAnswerAnalyzer";
import type { SavedRecordingInput } from "../infrastructure/storage/repositories/IndexedDbRecordingRepository";

export interface BrowserServices {
  readonly capabilities: BrowserCapabilityService;
  readonly mediaDevices: MediaDevicePort;
  readonly createMicrophoneLevelMonitor: (
    stream: MediaStream,
  ) => MicrophoneLevelMonitor;
  readonly startAudioMetricSession: (
    input: WebAudioAnalyzerInput,
  ) => Promise<WebAudioAnalyzerStartResult>;
  readonly startRecorderSession: (input: {
    readonly stream: MediaStream;
    readonly startedAtMs: number;
  }) => MediaRecorderStartResult;
  readonly startVideoAnalysisSession: (
    input: VideoAnalysisInput,
  ) => Promise<VideoAnalysisStartResult>;
  readonly saveRecordingAfterUserChoice: (
    input: SavedRecordingInput,
  ) => Promise<StorageResult<RecordingReference>>;
  readonly importResumeFile: ResumeFileImportService;
  readonly importJobPosting: JobPostingImportService;
  readonly companyResearch: CompanyResearchProvider;
  readonly transcription: TranscriptionProvider;
  readonly answerAnalyzer: PracticeAnswerAnalyzer;
}

const BrowserServicesContext = createContext<BrowserServices | null>(null);

interface BrowserServicesProviderProps {
  readonly children: ReactNode;
  readonly services?: BrowserServices;
}

export function BrowserServicesProvider({
  children,
  services,
}: BrowserServicesProviderProps) {
  const defaultServices = useMemo<BrowserServices>(
    () => ({
      capabilities: createBrowserCapabilityService(),
      mediaDevices: createBrowserMediaDeviceService(),
      createMicrophoneLevelMonitor: (stream) =>
        createBrowserMicrophoneLevelMonitor(stream),
      startAudioMetricSession: (input) => startWebAudioMetricSession(input),
      startRecorderSession: (input) => startMediaRecorderSession(input),
      startVideoAnalysisSession: (input) =>
        startBrowserVideoAnalysisSession(input),
      saveRecordingAfterUserChoice: (input) =>
        saveBrowserRecordingAfterUserChoice(input),
      importResumeFile: createBrowserResumeFileImportService(),
      importJobPosting: createUnavailableJobPostingImportService(),
      companyResearch: createUnavailableCompanyResearchProvider(),
      transcription: createBrowserSpeechRecognitionProvider(),
      answerAnalyzer: createDeterministicAnswerAnalyzer(),
    }),
    [],
  );

  return (
    <BrowserServicesContext.Provider value={services ?? defaultServices}>
      {children}
    </BrowserServicesContext.Provider>
  );
}

export function useBrowserServices() {
  const services = useContext(BrowserServicesContext);

  if (!services) {
    throw new Error("BrowserServicesProvider is missing.");
  }

  return services;
}
