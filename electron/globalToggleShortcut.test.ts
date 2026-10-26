import { describe, expect, it, vi } from "vitest";
import { createGlobalToggleShortcut, DEFAULT_GLOBAL_SHORTCUT, parseGlobalShortcut } from "./globalToggleShortcut";

describe("global toggle shortcut", () => {
  it("requires a modifier and normalizes supported accelerators", () => {
    expect(parseGlobalShortcut("Control+alt+space")).toBe(DEFAULT_GLOBAL_SHORTCUT);
    expect(parseGlobalShortcut("Win+Shift+n")).toBe("Super+Shift+N");
    for (const value of ["N", "Shift+N", "Ctrl", "Ctrl+Alt+", "Ctrl+BadKey", "Ctrl+Ctrl+A", null]) expect(parseGlobalShortcut(value)).toBeNull();
  });
  it("keeps the active shortcut on conflicts and persistence failures", async () => {
    const registered = new Set<string>();
    const registry = { register: vi.fn((key: string) => { if (key === "Ctrl+X") return false; registered.add(key); return true; }), unregister: vi.fn((key: string) => { registered.delete(key); }) };
    const persist = vi.fn(async () => {});
    const settings = createGlobalToggleShortcut(registry, () => {}, persist);
    await settings.set(DEFAULT_GLOBAL_SHORTCUT, false);
    expect((await settings.set("Ctrl+X")).ok).toBe(false);
    persist.mockRejectedValueOnce(new Error("disk full"));
    expect((await settings.set("Alt+N")).ok).toBe(false);
    expect(registered).toEqual(new Set([DEFAULT_GLOBAL_SHORTCUT]));
    expect(settings.current).toBe(DEFAULT_GLOBAL_SHORTCUT);
    expect((await settings.set("Alt+N")).ok).toBe(true);
    expect(registered).toEqual(new Set(["Alt+N"]));
    expect(persist).toHaveBeenLastCalledWith("Alt+N");
    const calls = persist.mock.calls.length;
    await settings.set("Alt+N");
    expect(persist).toHaveBeenCalledTimes(calls);
  });
});
