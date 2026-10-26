export const DEFAULT_GLOBAL_SHORTCUT = "Ctrl+Alt+Space";

export function parseGlobalShortcut(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 100) return null;
  const parts = value.split("+").map(part => part.trim());
  const key = parts.pop() ?? "";
  const aliases: Record<string, string> = { ctrl: "Ctrl", control: "Ctrl", alt: "Alt", shift: "Shift", meta: "Super", super: "Super", win: "Super", command: "Super" };
  const modifiers = parts.map(part => aliases[part.toLowerCase()]);
  if (modifiers.some(part => !part) || new Set(modifiers).size !== modifiers.length) return null;
  if (!/^(?:[a-z0-9]|F(?:[1-9]|1\d|2[0-4])|Space|Tab|Enter|Escape|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right)$/i.test(key)) return null;
  if (!modifiers.some(part => part === "Ctrl" || part === "Alt" || part === "Super")) return null;
  const keys = ["Space", "Tab", "Enter", "Escape", "Backspace", "Delete", "Insert", "Home", "End", "PageUp", "PageDown", "Up", "Down", "Left", "Right"];
  const normalizedKey = keys.find(part => part.toLowerCase() === key.toLowerCase()) ?? key.toUpperCase();
  return ["Ctrl", "Super", "Alt", "Shift"].filter(part => modifiers.includes(part)).concat(normalizedKey).join("+");
}

/** Register the replacement first, so a conflict never removes the working shortcut. */
export function createGlobalToggleShortcut(
  registry: { register: (key: string, handler: () => void) => boolean; unregister: (key: string) => void },
  handler: () => void,
  persist: (key: string) => Promise<void>,
) {
  let active = "";
  let pending = false;
  return {
    get current() { return active; },
    async set(value: unknown, save = true) {
      const next = parseGlobalShortcut(value);
      if (!next) return { ok: false, error: "invalid" };
      if (pending) return { ok: false, error: "busy" };
      if (next === active) return { ok: true, shortcut: active };
      pending = true;
      try {
        if (!registry.register(next, handler)) return { ok: false, error: "conflict" };
        try { if (save) await persist(next); }
        catch { registry.unregister(next); return { ok: false, error: "save" }; }
        if (active) registry.unregister(active);
        active = next;
        return { ok: true, shortcut: active };
      } catch { return { ok: false, error: "invalid" }; }
      finally { pending = false; }
    },
  };
}
