import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const prohibitedPatterns = [
  {
    id: "unsupported-confidence",
    pattern: /\b(confidence score|looked confident|lacked confidence)\b/i,
  },
  {
    id: "unsupported-emotion",
    pattern: /\b(emotion detected|looked nervous|facial emotion)\b/i,
  },
  {
    id: "unsupported-honesty",
    pattern: /\b(honesty score|dishonest|deception detected)\b/i,
  },
  {
    id: "unsupported-employability",
    pattern: /\b(strong candidate|employability score|job competence score)\b/i,
  },
  {
    id: "unsupported-proctoring",
    pattern: /\b(suspicious movement|cheating detected)\b/i,
  },
  {
    id: "unsupported-eye-contact",
    pattern: /\b(good eye contact|bad eye contact|eye contact score)\b/i,
  },
  {
    id: "combined-score",
    pattern: /\b(overall score|combined performance score|candidate score)\b/i,
  },
];

const documentationAllowlist = [
  {
    pathPattern: /^docs[\\/]spec[\\/]/,
    reason: "Authoritative specification and prohibited-feature policy text.",
  },
  {
    pathPattern: /^README\.md$/,
    reason: "Repository scope and policy documentation.",
  },
  {
    pathPattern: /^docs[\\/]traceability\.md$/,
    reason: "Requirement traceability documentation.",
  },
  {
    pathPattern: /^tests[\\/]fixtures[\\/]prohibited[\\/]allowed-policy\.md$/,
    reason: "Reviewed scanner allowlist fixture.",
  },
];

const ignoredNames = new Set([
  ".git",
  ".npm-cache",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

const scanRoots = ["src", "public", "docs", "README.md"];

function toRelative(filePath) {
  return path.relative(root, filePath);
}

function isAllowedDocumentation(relativePath) {
  return documentationAllowlist.some((entry) =>
    entry.pathPattern.test(relativePath),
  );
}

function* walk(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const stats = readdirOrFile(filePath);

  if (stats.kind === "file") {
    yield filePath;
    return;
  }

  for (const entry of stats.entries) {
    if (ignoredNames.has(entry.name)) {
      continue;
    }

    yield* walk(path.join(filePath, entry.name));
  }
}

function readdirOrFile(filePath) {
  const directoryEntries = tryReadDirectory(filePath);

  if (directoryEntries) {
    return { kind: "directory", entries: directoryEntries };
  }

  return { kind: "file" };
}

function tryReadDirectory(filePath) {
  try {
    return readdirSync(filePath, { withFileTypes: true });
  } catch {
    return null;
  }
}

export function findProhibitedLanguage(filePath) {
  const text = readFileSync(filePath, "utf8");
  const relativePath = toRelative(filePath);
  const allowed = isAllowedDocumentation(relativePath);
  const violations = [];

  for (const { id, pattern } of prohibitedPatterns) {
    if (pattern.test(text) && !allowed) {
      violations.push({ file: relativePath, id });
    }
  }

  return violations;
}

function runSelfTest() {
  const failingFixture = path.join(
    root,
    "tests",
    "fixtures",
    "prohibited",
    "failing-copy.txt",
  );
  const allowedFixture = path.join(
    root,
    "tests",
    "fixtures",
    "prohibited",
    "allowed-policy.md",
  );

  const failingViolations = findProhibitedLanguage(failingFixture);
  if (failingViolations.length === 0) {
    throw new Error("Prohibited-language failing fixture did not fail.");
  }

  const allowedViolations = findProhibitedLanguage(allowedFixture);
  if (allowedViolations.length > 0) {
    throw new Error("Documentation allowlist fixture was not honored.");
  }
}

function main() {
  runSelfTest();

  const violations = scanRoots.flatMap((scanRoot) =>
    Array.from(walk(path.join(root, scanRoot))).flatMap((filePath) => {
      if (!/\.(css|html|js|jsx|md|mjs|ts|tsx|txt)$/.test(filePath)) {
        return [];
      }

      return findProhibitedLanguage(filePath);
    }),
  );

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`${violation.file}: prohibited copy ${violation.id}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log("Prohibited-language scan passed.");
}

main();
