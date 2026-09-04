import { englishMessages } from "./uiMessages";

export type UiLanguage = "zh-CN" | "en-US";
export const LANGUAGE_KEY = "super-note-language";
let language: UiLanguage = "zh-CN";
try {
  if (globalThis.localStorage?.getItem(LANGUAGE_KEY) === "en-US") language = "en-US";
} catch { /* Electron main process has no browser storage. */ }

export function getUiLanguage(): UiLanguage { return language; }

export function setUiLanguage(value: UiLanguage) {
  language = value;
  try { globalThis.localStorage?.setItem(LANGUAGE_KEY, value); } catch { /* Main process. */ }
  if (typeof document !== "undefined") document.documentElement.lang = value;
}

/** Only application-authored strings are passed here. Interpolated user data is preserved. */
export function uiText(source: string, values: unknown[] = []): string {
  const message = language === "en-US" ? englishMessages[source] ?? source : source;
  return message.replace(/\{(\d+)\}/g, (token, index) => index < values.length ? String(values[index]) : token);
}
