import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const distRoot = path.join(root, "dist");
const failures = [];

if (!existsSync(distRoot)) {
  fail("dist/ does not exist. Run npm run build before audit:build.");
} else {
  auditInitialHtml();
  auditWorkerArtifacts();
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exitCode = 1;
} else {
  console.log("Production build artifact audit passed.");
}

function auditInitialHtml() {
  const indexPath = path.join(distRoot, "index.html");
  if (!existsSync(indexPath)) {
    fail("dist/index.html was not emitted.");
    return;
  }

  const html = readFileSync(indexPath, "utf8");
  if (/mediapipe\/|videoAnalysis\.worker/i.test(html)) {
    fail("Initial HTML preloads MediaPipe or the video-analysis worker.");
  }
}

function auditWorkerArtifacts() {
  const files = walkFiles(distRoot);
  const workerFiles = files.filter((filePath) =>
    /videoAnalysis\.worker/i.test(path.basename(filePath)),
  );

  if (workerFiles.length === 0) {
    fail("No emitted videoAnalysis.worker production artifact was found.");
    return;
  }

  for (const workerFile of workerFiles) {
    const relativePath = path
      .relative(distRoot, workerFile)
      .replace(/\\/g, "/");
    if (/\.ts$/i.test(workerFile)) {
      fail(`Worker was emitted as raw TypeScript: ${relativePath}`);
      continue;
    }

    if (!/\.(?:m?js)$/i.test(workerFile)) {
      fail(`Worker artifact is not executable JavaScript: ${relativePath}`);
      continue;
    }

    const code = readFileSync(workerFile, "utf8");
    auditCompiledWorkerCode(relativePath, workerFile, code);
  }
}

function auditCompiledWorkerCode(relativePath, workerFile, code) {
  if (/\bimport\s+type\b/.test(code)) {
    fail(`Worker contains TypeScript import type syntax: ${relativePath}`);
  }

  if (/\bMessageEvent\s*</.test(code)) {
    fail(`Worker contains TypeScript generic annotations: ${relativePath}`);
  }

  if (
    /\bfrom\s*["'](?:@mediapipe\/tasks-vision|\.\/(?:aggregate|conditions|videoWorkerProtocol))["']/.test(
      code,
    )
  ) {
    fail(`Worker contains unresolved source imports: ${relativePath}`);
  }

  if (/\.(?:ts|tsx)["']/.test(code)) {
    fail(`Worker references raw TypeScript source files: ${relativePath}`);
  }

  const importSpecifiers = collectImportSpecifiers(code);
  for (const specifier of importSpecifiers) {
    if (isBareSpecifier(specifier)) {
      fail(
        `Worker contains unresolved bare import "${specifier}": ${relativePath}`,
      );
      continue;
    }

    const resolvedPath = resolveDistSpecifier(workerFile, specifier);
    if (!resolvedPath || !existsSync(resolvedPath)) {
      fail(
        `Worker import "${specifier}" does not resolve to an emitted file: ${relativePath}`,
      );
    }
  }
}

function collectImportSpecifiers(code) {
  const specifiers = new Set();
  const staticImportPattern =
    /\bimport\s+(?:[^"'()]*?\s+from\s*)?["']([^"']+)["']/g;
  const dynamicImportPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

  for (const pattern of [staticImportPattern, dynamicImportPattern]) {
    for (const match of code.matchAll(pattern)) {
      if (match[1]) {
        specifiers.add(match[1]);
      }
    }
  }

  return specifiers;
}

function resolveDistSpecifier(importerPath, specifier) {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return path.resolve(path.dirname(importerPath), specifier);
  }

  const basePath = "/fairscreen/";
  if (specifier.startsWith(basePath)) {
    return path.join(distRoot, specifier.slice(basePath.length));
  }

  if (specifier.startsWith("/")) {
    return path.join(distRoot, specifier.slice(1));
  }

  return undefined;
}

function isBareSpecifier(specifier) {
  return (
    !specifier.startsWith("./") &&
    !specifier.startsWith("../") &&
    !specifier.startsWith("/") &&
    !/^[a-z][a-z\d+\-.]*:/i.test(specifier)
  );
}

function walkFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(filePath));
      continue;
    }

    if (entry.isFile() && statSync(filePath).isFile()) {
      files.push(filePath);
    }
  }
  return files;
}

function fail(message) {
  failures.push(message);
}
