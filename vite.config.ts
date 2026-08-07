import { readFileSync } from "node:fs";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const appVersion = readPackageVersion();

export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/fairscreen/",
  define: {
    __FAIRSCREEN_APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react()],
  build: {
    cssMinify: false,
    sourcemap: false,
  },
}));

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
