import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const packageJson = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
);

const allowedRuntimeDependencies = new Set([
  "@mediapipe/tasks-vision",
  "lucide-react",
  "mammoth",
  "pdfjs-dist",
  "react",
  "react-dom",
  "react-router-dom",
  "zod",
]);

const disallowedNameFragments = [
  "analytics",
  "datadog",
  "firebase",
  "gtag",
  "hotjar",
  "logrocket",
  "mixpanel",
  "newrelic",
  "sentry",
  "segment",
  "tracking",
];

const violations = [];

const runtimeDependencies = Object.keys(packageJson.dependencies ?? {});
for (const dependency of runtimeDependencies) {
  if (!allowedRuntimeDependencies.has(dependency)) {
    violations.push(`Unapproved runtime dependency: ${dependency}`);
  }

  if (
    disallowedNameFragments.some((fragment) => dependency.includes(fragment))
  ) {
    violations.push(`Tracking or remote diagnostics dependency: ${dependency}`);
  }
}

for (const [dependency, version] of Object.entries({
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
})) {
  if (typeof version !== "string" || /^[~^*]/.test(version)) {
    violations.push(`Dependency is not exact-pinned: ${dependency}@${version}`);
  }
}

if (packageJson.packageManager !== "npm@11.12.1") {
  violations.push("packageManager must pin npm@11.12.1.");
}

if (packageJson.engines?.node !== "24.15.0") {
  violations.push("engines.node must pin Node 24.15.0.");
}

for (const filePath of walkSelectedSource()) {
  const text = readFileSync(filePath, "utf8");
  const relativePath = path.relative(root, filePath);
  const normalizedRelativePath = relativePath.split(path.sep).join("/");

  if (normalizedRelativePath.startsWith("public/mediapipe/wasm/")) {
    continue;
  }

  if (/https?:\/\//i.test(text)) {
    violations.push(`Remote runtime URL found in source: ${relativePath}`);
  }

  if (/navigator\.serviceWorker|manifest\.webmanifest/i.test(text)) {
    violations.push(`Service-worker or PWA hint found: ${relativePath}`);
  }

  if (
    /navigator\.mediaDevices|indexedDB\.(?:open|deleteDatabase|cmp)|(?:window|globalThis)\.(?:SpeechRecognition|MediaRecorder)|new\s+(?:SpeechRecognition|MediaRecorder)|\bMediaRecorder\./.test(
      text,
    ) &&
    !relativePath.startsWith(path.join("src", "infrastructure", "storage")) &&
    !relativePath.startsWith(path.join("src", "infrastructure", "browser"))
  ) {
    violations.push(
      `Browser capability bypasses its infrastructure boundary: ${relativePath}`,
    );
  }
}

function* walkSelectedSource() {
  for (const sourceRoot of ["index.html", "public", "src"]) {
    yield* walk(path.join(root, sourceRoot));
  }
}

function* walk(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const directoryEntries = tryReadDirectory(filePath);

  if (!directoryEntries) {
    if (/\.(css|html|js|jsx|mjs|ts|tsx)$/.test(filePath)) {
      yield filePath;
    }
    return;
  }

  for (const entry of directoryEntries) {
    if (["dist", "node_modules"].includes(entry.name)) {
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

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }

  process.exitCode = 1;
} else {
  console.log("Dependency and source audit passed.");
}
