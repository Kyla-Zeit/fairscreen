import { z } from "zod";

const PublicAppConfigSchema = z
  .object({
    appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    basePath: z.literal("/fairscreen/"),
    specVersion: z.literal("1.0"),
    databaseName: z.literal("fairscreen"),
    modelPath: z.string().startsWith("/fairscreen/"),
    wasmRootPath: z.string().startsWith("/fairscreen/"),
    videoSampleFps: z.number().int().min(5).max(10),
    maxQuestions: z.literal(10),
    maxContextCharacters: z.literal(20_000),
    softRecordingBytes: z.number().int().positive(),
    featureFlags: z
      .object({
        videoAnalysis: z.boolean(),
        backlightingLabel: z.boolean(),
        browserSpeech: z.boolean(),
        savedRecordings: z.boolean(),
      })
      .strict(),
  })
  .strict();

const publicConfigInput = {
  appVersion: __FAIRSCREEN_APP_VERSION__,
  basePath: "/fairscreen/",
  specVersion: "1.0",
  databaseName: "fairscreen",
  modelPath: "/fairscreen/mediapipe/models/face_landmarker.task",
  wasmRootPath: "/fairscreen/mediapipe/wasm",
  videoSampleFps: 8,
  maxQuestions: 10,
  maxContextCharacters: 20_000,
  softRecordingBytes: 250 * 1024 * 1024,
  featureFlags: {
    videoAnalysis: true,
    backlightingLabel: false,
    browserSpeech: false,
    savedRecordings: true,
  },
} as const;

export const publicAppConfig = PublicAppConfigSchema.parse(publicConfigInput);
