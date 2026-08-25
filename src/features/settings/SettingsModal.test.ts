import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "./SettingsModal";

describe("tab layout settings", () => {
  it("restores old workspaces to the top tab bar with Ctrl+B available", () => {
    const settings = normalizeSettings({});
    expect(settings.tabLayout).toBe("top");
    expect(settings.sidebarWidth).toBe(220);
    expect(settings.shortcuts.toggleTabLayout).toBe("Ctrl+B");
    expect(settings.shortcuts.toggleFullscreen).toBe("Ctrl+H");
    expect(settings.shortcuts.fileFontReset).toBe("Ctrl+0");
  });

  it("preserves the left tab menu preference", () => {
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, tabLayout: "left", sidebarWidth: 318 });
    expect(settings.tabLayout).toBe("left");
    expect(settings.sidebarWidth).toBe(318);
  });

  it("keeps restored sidebar widths inside the usable range", () => {
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, sidebarWidth: 80 }).sidebarWidth).toBe(160);
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, sidebarWidth: 900 }).sidebarWidth).toBe(480);
  });
});
