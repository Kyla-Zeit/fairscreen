import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageWasmDirectory = path.join(
  root,
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "wasm",
);
const publicWasmDirectory = path.join(root, "public", "mediapipe", "wasm");
const modelDirectory = path.join(root, "public", "mediapipe", "models");
const modelPath = path.join(modelDirectory, "face_landmarker.task");

const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const expectedModelSha256 =
  "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff";

await prepareWasm();
await prepareModel();

async function prepareWasm() {
  await access(packageWasmDirectory).catch(() => {
    throw new Error(
      "MediaPipe WASM files are unavailable. Run npm ci before starting or building FairScreen.",
    );
  });

  await mkdir(publicWasmDirectory, { recursive: true });
  const packageFiles = await readdir(packageWasmDirectory, {
    withFileTypes: true,
  });

  const runtimeFiles = packageFiles
    .filter(
      (entry) =>
        entry.isFile() &&
        /^vision_wasm_(?:module_|nosimd_)?internal\.(?:js|wasm)$/.test(
          entry.name,
        ),
    )
    .map((entry) => entry.name)
    .sort();

  if (runtimeFiles.length !== 6) {
    throw new Error(
      `Expected 6 pinned MediaPipe WASM runtime files, found ${runtimeFiles.length}.`,
    );
  }

  for (const fileName of runtimeFiles) {
    await copyFile(
      path.join(packageWasmDirectory, fileName),
      path.join(publicWasmDirectory, fileName),
    );
  }
}

async function prepareModel() {
  await mkdir(modelDirectory, { recursive: true });

  if (await fileMatchesChecksum(modelPath, expectedModelSha256)) {
    return;
  }

  await rm(modelPath, { force: true });

  const response = await fetch(modelUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error(
      `Unable to download the pinned MediaPipe Face Landmarker model (${response.status}).`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");

  if (actualSha256 !== expectedModelSha256) {
    throw new Error(
      `MediaPipe model checksum mismatch. Expected ${expectedModelSha256}, received ${actualSha256}.`,
    );
  }

  await writeFile(modelPath, bytes);
}

async function fileMatchesChecksum(filePath, expectedSha256) {
  try {
    const bytes = await readFile(filePath);
    return createHash("sha256").update(bytes).digest("hex") === expectedSha256;
  } catch {
    return false;
  }
}
