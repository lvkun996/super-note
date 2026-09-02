import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve("electron-updater"))("js-yaml");
const UPDATE_URL = "https://github.com/lvkun996/super-note/releases/latest/download/";

export function verifyUpdateConfig(filePath, expectedChannel = "latest") {
  const config = load(readFileSync(filePath, "utf8"));
  if (!config || config.provider !== "generic" || config.url !== UPDATE_URL) {
    throw new Error(`Invalid updater provider or URL: ${filePath}`);
  }
  if ((config.channel ?? "latest") !== expectedChannel) {
    throw new Error(`Invalid updater channel: ${filePath}`);
  }
  if (typeof config.updaterCacheDirName !== "string" || !/^[a-zA-Z0-9_-]+$/.test(config.updaterCacheDirName)) {
    throw new Error(`Missing or invalid updaterCacheDirName: ${filePath}`);
  }
  return config;
}
