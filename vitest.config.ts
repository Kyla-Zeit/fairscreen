import { readFileSync } from "node:fs";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const appVersion = readPackageVersion();

export default defineConfig({
  define: {
    __FAIRSCREEN_APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react()],
  test: {
    css: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/shared/test/setup.ts"],
  },
});

function readPackageVersion(): string {
  const packageJson = JSON.parse(
    readFileSync(new URL("./package.json", import.meta.url), "utf8"),
  ) as unknown;

  if (
    typeof packageJson === "object" &&
    packageJson !== null &&
    "version" in packageJson &&
    typeof packageJson.version === "string"
  ) {
    return packageJson.version;
  }

  throw new Error("package.json must contain a string version.");
}
