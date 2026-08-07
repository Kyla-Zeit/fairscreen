import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const host = "127.0.0.1";
const port = 4173;
const appPath = "/fairscreen/";
const appUrl = `http://${host}:${port}${appPath}`;
const distRoot = path.resolve(root, "dist");
const indexPath = path.join(distRoot, "index.html");
const playwrightBin = path.join(root, "node_modules", "playwright", "cli.js");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".task", "application/octet-stream"],
  [".wasm", "application/wasm"],
  [".webmanifest", "application/manifest+json"],
]);

await stat(indexPath);
await stat(playwrightBin);

const server = createServer((request, response) => {
  void serveRequest(request, response);
});

await startServer();
console.log(`FairScreen browser-test server: ${appUrl}`);

try {
  process.exitCode = await runPlaywright();
} finally {
  await stopServer();
}

function startServer() {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

async function serveRequest(request, response) {
  try {
    const requestUrl = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? `${host}:${port}`}`,
    );

    if (!requestUrl.pathname.startsWith(appPath)) {
      respond(response, 404, "text/plain; charset=utf-8", "Not found");
      return;
    }

    const relativePath = decodeURIComponent(
      requestUrl.pathname.slice(appPath.length),
    );
    const requestedPath = relativePath
      ? path.resolve(distRoot, relativePath)
      : indexPath;

    if (!isInsideDist(requestedPath)) {
      respond(response, 404, "text/plain; charset=utf-8", "Not found");
      return;
    }

    const filePath = await resolveFile(requestedPath, relativePath);
    if (!filePath) {
      respond(response, 404, "text/plain; charset=utf-8", "Not found");
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type":
        contentTypes.get(path.extname(filePath).toLowerCase()) ??
        "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    console.error(error);
    respond(
      response,
      500,
      "text/plain; charset=utf-8",
      "Browser-test server error",
    );
  }
}

async function resolveFile(requestedPath, relativePath) {
  try {
    const fileStats = await stat(requestedPath);
    if (fileStats.isFile()) return requestedPath;
    if (fileStats.isDirectory()) return indexPath;
  } catch {
    if (!path.extname(relativePath)) return indexPath;
  }
  return undefined;
}

function isInsideDist(candidatePath) {
  return (
    candidatePath === distRoot ||
    candidatePath.startsWith(`${distRoot}${path.sep}`)
  );
}

function respond(response, statusCode, contentType, body) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  });
  response.end(body);
}

function runPlaywright() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [playwrightBin, "test"], {
      cwd: root,
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: appUrl,
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

function stopServer() {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
    server.closeAllConnections?.();
  });
}
