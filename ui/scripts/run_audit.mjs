import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.resolve(__dirname, "..");
const EDGE_CDP = "C:\\Users\\LATIF\\Documents\\KC-Tools\\edge_cdp.mjs";
const VITE_BIN = path.join(UI_DIR, "node_modules", "vite", "bin", "vite.js");
const PORT = "4173";
const AUDIT_URL = `http://127.0.0.1:${PORT}`;
const SHOT_DIR =
  process.env.SHOT_DIR ||
  "C:\\Users\\LATIF\\.gemini\\antigravity\\brain\\c3c17152-d0d2-4367-adf3-3074f4a4c69e";

function startPreviewServer() {
  return new Promise((resolve, reject) => {
    let settled = false;
    let output = "";

    const child = spawn(
      process.execPath,
      [VITE_BIN, "preview", "--port", PORT, "--host", "127.0.0.1", "--strictPort"],
      {
        cwd: UI_DIR,
        env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const onChunk = (buf) => {
      const clean = buf.toString("utf8").replace(/\x1b\[[0-9;]*m/g, "");
      output += clean;
      if (!settled && (clean.includes(`:${PORT}`) || output.includes(`:${PORT}`))) {
        settled = true;
        resolve(child);
      }
    };

    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);

    child.once("error", (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    child.once("exit", (code, signal) => {
      if (!settled) {
        settled = true;
        reject(new Error(`Vite preview exited early (${code ?? signal}):\n${output}`));
      }
    });
  });
}

function stopServer(child) {
  if (!child || child.killed || child.pid == null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], {
      stdio: "ignore",
    });
  } else {
    child.kill("SIGTERM");
  }
}

function runCdpScript(scriptRelPath, extraEnv = {}) {
  const scriptPath = path.join(UI_DIR, scriptRelPath);
  const res = spawnSync(process.execPath, [EDGE_CDP, scriptPath], {
    cwd: UI_DIR,
    env: {
      ...process.env,
      AUDIT_URL,
      SHOT_DIR,
      WIDTHS: process.env.WIDTHS || "360,375,480,768,1024,1366,1440",
      ...extraEnv,
    },
    stdio: "inherit",
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`${scriptRelPath} failed with exit code ${res.status}`);
  }
}

const server = await startPreviewServer();
try {
  runCdpScript("scripts/browser_audit.mjs");
  runCdpScript("scripts/browser_audit.mjs", { AUDIT_URL: `${AUDIT_URL}/?desktop=1` });
  runCdpScript("scripts/capture_shots.mjs");
} finally {
  stopServer(server);
}
