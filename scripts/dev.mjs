import { spawn } from "node:child_process";
import { createServer } from "vite";

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

const electronBin = process.platform === "win32"
  ? "node_modules\\.bin\\electron.cmd"
  : "node_modules/.bin/electron";

const electron = spawn(electronBin, ["."] , {
  stdio: "inherit",
  shell: false,
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devUrl,
  },
});

electron.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});

process.on("SIGINT", async () => {
  electron.kill();
  await server.close();
  process.exit(0);
});
