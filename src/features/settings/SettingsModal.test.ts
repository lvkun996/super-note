import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "./SettingsModal";

describe("tab layout settings", () => {
  it("restores old workspaces to the top tab bar with Ctrl+B available", () => {
    const settings = normalizeSettings({});
    expect(settings.tabLayout).toBe("top");
    expect(settings.shortcuts.toggleTabLayout).toBe("Ctrl+B");
  });

  it("preserves the left tab menu preference", () => {
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, tabLayout: "left" }).tabLayout).toBe("left");
  });
});
