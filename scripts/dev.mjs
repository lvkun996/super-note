import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { createServer } from "vite";

const require = createRequire(import.meta.url);

const compileElectron = spawnSync(
  process.execPath,
  [path.join(process.cwd(), "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.electron.json"],
  { stdio: "inherit" },
);
if (compileElectron.error) {
  throw compileElectron.error;
}
if (compileElectron.status !== 0) {
  process.exit(compileElectron.status ?? 1);
}

const server = await createServer({
  configFile: "vite.config.ts",
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});

await server.listen();
const urls = server.resolvedUrls?.local ?? ["http://127.0.0.1:5173/"];
const devUrl = urls[0];

const electronBin = require("electron");

const electron = spawn(electronBin, ["."] , {
  stdio: "inherit",
  shell: false,
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devUrl,
    SUPER_NOTE_DEV_USER_DATA: path.join(process.cwd(), ".tmp-home", "dev-user-data"),
    SUPER_NOTE_ALLOW_MULTIPLE_INSTANCES: "1",
  },
});

electron.on("error", async (error) => {
  console.error("Electron failed to start:", error);
  await server.close();
  process.exit(1);
});

electron.on("exit", async (code, signal) => {
  if (code !== 0 || signal) {
    console.error(`Electron exited before the dev server stopped (code=${code ?? "null"}, signal=${signal ?? "none"}).`);
  }
  await server.close();
  process.exit(code ?? 0);
});

process.on("SIGINT", async () => {
  electron.kill();
  await server.close();
  process.exit(0);
});
