import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const ignoredNames = new Set([
  ".git",
  ".npm-cache",
  "dist",
  "docs",
  "node_modules",
  "package-lock.json",
  "playwright-report",
  "test-results",
]);

const scanRoots = [
  ".github",
  "index.html",
  "package.json",
  "playwright.config.ts",
  "scripts",
  "src",
  "vite.config.ts",
  "vitest.config.ts",
];

const secretPatterns = [
  { id: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  { id: "openai-token", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  {
    id: "vite-secret-config",
    pattern: /\bVITE_[A-Z0-9_]*(SECRET|TOKEN|API_KEY|PRIVATE_KEY)\b/,
  },
];

function* walk(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const directoryEntries = tryReadDirectory(filePath);

  if (!directoryEntries) {
    yield filePath;
    return;
  }

  for (const entry of directoryEntries) {
    if (ignoredNames.has(entry.name)) {
      continue;
    }

    yield* walk(path.join(filePath, entry.name));
  }
}

function tryReadDirectory(filePath) {
  try {
    return readdirSync(filePath, { withFileTypes: true });
  } catch {
    return null;
  }
}

const violations = scanRoots.flatMap((scanRoot) =>
  Array.from(walk(path.join(root, scanRoot))).flatMap((filePath) => {
    if (!/\.(css|html|js|jsx|json|md|mjs|ts|tsx|yml|yaml)$/.test(filePath)) {
      return [];
    }

    const text = readFileSync(filePath, "utf8");
    const relativePath = path.relative(root, filePath);

    return secretPatterns
      .filter(({ pattern }) => pattern.test(text))
      .map(({ id }) => `${relativePath}: secret-shaped value ${id}`);
  }),
);

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }

  process.exitCode = 1;
} else {
  console.log("Secret scan passed.");
}
