import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";
import { publicAppConfig } from "./config";

describe("public app config", () => {
  it("pins validated public configuration without secret-shaped fields", () => {
    expect(publicAppConfig).toEqual({
      appVersion: packageJson.version,
      basePath: "/fairscreen/",
      specVersion: "1.0",
      databaseName: "fairscreen",
      modelPath: "/fairscreen/mediapipe/models/face_landmarker.task",
      wasmRootPath: "/fairscreen/mediapipe/wasm",
      videoSampleFps: 8,
      maxQuestions: 10,
      maxContextCharacters: 20_000,
      softRecordingBytes: 262_144_000,
      featureFlags: {
        videoAnalysis: true,
        backlightingLabel: false,
        browserSpeech: false,
        savedRecordings: true,
      },
    });
    expect(Object.keys(publicAppConfig).join(" ")).not.toMatch(
      /secret|token|key/i,
    );
  });

  it("uses package.json as the application version source of truth", () => {
    expect(publicAppConfig.appVersion).toBe(packageJson.version);
  });
});
