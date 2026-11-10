import { normalizeTextScale } from "./settingsModel";

const TEXT_SCALE_KEY = "super-note-text-scale";

export function textScaleTokens(value: number) {
  const scale = normalizeTextScale(value) / 100;
  return {
    fontSize: 14 * scale,
    fontSizeSM: 12 * scale,
    fontSizeLG: 16 * scale,
    fontSizeXL: 20 * scale,
    fontSizeHeading1: 38 * scale,
    fontSizeHeading2: 30 * scale,
    fontSizeHeading3: 24 * scale,
    fontSizeHeading4: 20 * scale,
    fontSizeHeading5: 16 * scale,
  };
}

function applyTextScale(value: number) {
  document.documentElement.style.setProperty("--global-text-scale", String(value / 100));
}

/** Share the main window's preference with auxiliary windows on the same origin. */
export function initializeTextScale() {
  try {
    const stored = localStorage.getItem(TEXT_SCALE_KEY);
    if (stored !== null) applyTextScale(normalizeTextScale(Number(stored)));
  } catch { /* The workspace remains the source of truth when storage is unavailable. */ }
  window.addEventListener("storage", (event) => {
    if (event.key === TEXT_SCALE_KEY) applyTextScale(normalizeTextScale(event.newValue === null ? undefined : Number(event.newValue)));
  });
}

export function updateTextScale(value: number) {
  const scale = normalizeTextScale(value);
  applyTextScale(scale);
  try { localStorage.setItem(TEXT_SCALE_KEY, String(scale)); } catch { /* Saved with workspace settings. */ }
}
