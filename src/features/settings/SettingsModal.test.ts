import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings, normalizeShortcut } from "./settingsModel";

describe("tab layout settings", () => {
  it("restores old workspaces with separate sidebar and layout shortcuts", () => {
    const settings = normalizeSettings({});
    expect(settings.tabLayout).toBe("top");
    expect(settings.sidebarVisible).toBe(true);
    expect(settings.sidebarWidth).toBe(220);
    expect(settings.defaultSaveDirectory).toBe("");
    expect(settings.shortcuts.toggleSidebar).toBe("Ctrl+B");
    expect(settings.shortcuts.toggleTabLayout).toBe("Ctrl+Shift+B");
    expect(settings.shortcuts.toggleFullscreen).toBe("Ctrl+H");
    expect(settings.shortcuts.fileFontReset).toBe("Ctrl+0");
  });

  it("migrates the old Ctrl+B layout shortcut without overriding custom shortcuts", () => {
    expect(normalizeSettings({ shortcuts: { ...DEFAULT_SETTINGS.shortcuts, toggleTabLayout: "Ctrl+B" } }).shortcuts.toggleTabLayout).toBe("Ctrl+Shift+B");
    expect(normalizeSettings({ shortcuts: { ...DEFAULT_SETTINGS.shortcuts, toggleTabLayout: "Alt+B" } }).shortcuts.toggleTabLayout).toBe("Alt+B");
  });

  it("preserves the default save directory", () => {
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, defaultSaveDirectory: "D:\\Notes" }).defaultSaveDirectory).toBe("D:\\Notes");
  });

  it("preserves the left tab menu preference", () => {
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, tabLayout: "left", sidebarVisible: false, sidebarWidth: 318 });
    expect(settings.tabLayout).toBe("left");
    expect(settings.sidebarVisible).toBe(false);
    expect(settings.sidebarWidth).toBe(318);
  });

  it("keeps restored sidebar widths inside the usable range", () => {
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, sidebarWidth: 80 }).sidebarWidth).toBe(160);
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, sidebarWidth: 900 }).sidebarWidth).toBe(480);
  });

  it("normalizes vertical tab navigation shortcuts", () => {
    expect(normalizeShortcut("Ctrl+ArrowUp")).toBe("Ctrl+Up");
    expect(normalizeShortcut("Ctrl+ArrowDown")).toBe("Ctrl+Down");
  });
});
