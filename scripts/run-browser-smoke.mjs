import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const root = process.cwd();
const requestedPreviewUrl = "http://127.0.0.1:4173/fairscreen/";
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const playwrightBin = path.join(root, "node_modules", "playwright", "cli.js");
let actualPreviewUrl = "";

if (!existsSync(viteBin)) {
  throw new Error("Vite CLI was not found. Run npm ci first.");
}

if (!existsSync(playwrightBin)) {
  throw new Error("Playwright CLI was not found. Run npm ci first.");
}

const preview = spawn(
  process.execPath,
  [viteBin, "preview", "--host", "127.0.0.1", "--port", "4173"],
  {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);

preview.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  const match = stripAnsi(text).match(
    /http:\/\/127\.0\.0\.1:\d+\/fairscreen\//,
  );
  if (match) {
    actualPreviewUrl = match[0];
  }
});

preview.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

try {
  await waitForPreview();
  const exitCode = await runPlaywright();
  process.exitCode = exitCode;
} finally {
  await stopPreview();
}

async function waitForPreview() {
  const startedAt = Date.now();
  const timeoutMs = 30_000;

  while (Date.now() - startedAt < timeoutMs) {
    if (preview.exitCode !== null) {
      throw new Error(
        `Vite preview exited early with code ${preview.exitCode}.`,
      );
    }

    if (!actualPreviewUrl) {
      await delay(250);
      continue;
    }

    try {
      const response = await fetch(actualPreviewUrl);
      if (response.ok) {
        return;
      }
    } catch {
      await delay(250);
    }
  }

  throw new Error(
    `Vite preview did not become ready. Requested ${requestedPreviewUrl}.`,
  );
}

async function runPlaywright() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [playwrightBin, "test"], {
      cwd: root,
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: actualPreviewUrl,
        PW_TEST_HTML_REPORT_OPEN: "never",
      },
      stdio: "inherit",
      windowsHide: true,
    });

    child.on("exit", (code) => {
      resolve(code ?? 1);
    });
  });
}

async function stopPreview() {
  if (preview.exitCode !== null) {
    return;
  }

  preview.kill();

  const exited = await Promise.race([
    new Promise((resolve) => {
      preview.once("exit", () => {
        resolve(true);
      });
    }),
    delay(5_000).then(() => false),
  ]);

  if (!exited && process.platform === "win32" && preview.pid) {
    await new Promise((resolve) => {
      const killer = spawn(
        "taskkill",
        ["/PID", String(preview.pid), "/T", "/F"],
        {
          stdio: "ignore",
          windowsHide: true,
        },
      );
      killer.on("exit", () => {
        resolve(undefined);
      });
    });
  }
}

function stripAnsi(text) {
  const escapeCharacter = String.fromCharCode(27);
  return text.replace(
    new RegExp(`${escapeCharacter}\\[[0-?]*[ -/]*[@-~]`, "g"),
    "",
  );
}
