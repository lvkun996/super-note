import { useEffect, useRef, useState } from "react";
import { Button, Input } from "antd";
import { uiText } from "../../../electron/uiLanguage";
import { DEFAULT_GLOBAL_SHORTCUT } from "../../../electron/globalToggleShortcut";
import { shortcutFromEvent } from "./settingsModel";

export function GlobalShortcutSetting({ open }: { open: boolean }) {
  const [saved, setSaved] = useState(DEFAULT_GLOBAL_SHORTCUT);
  const [draft, setDraft] = useState(DEFAULT_GLOBAL_SHORTCUT);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    if (!open) return;
    const id = ++request.current;
    void window.superNote?.getAppInfo().then(info => {
      if (id !== request.current) return;
      setSaved(info.globalShortcut ?? DEFAULT_GLOBAL_SHORTCUT);
      setDraft(info.globalShortcut ?? DEFAULT_GLOBAL_SHORTCUT);
      setError("");
    }).catch(() => setError(uiText("无法读取全局快捷键")));
    return () => { request.current++; };
  }, [open]);
  const save = async (value: string) => {
    setBusy(true); setError("");
    try {
      const result = await window.superNote?.setGlobalShortcut(value);
      if (!result?.ok) {
        setError(result?.error === "conflict" ? uiText("快捷键已被占用，请选择其他组合") : uiText("快捷键保存失败，请使用 Ctrl、Alt 或 Win 加一个按键"));
        return;
      }
      setSaved(result.shortcut ?? value); setDraft(result.shortcut ?? value);
    } catch { setError(uiText("快捷键保存失败，请使用 Ctrl、Alt 或 Win 加一个按键")); }
    finally { setBusy(false); }
  };
  return <div className="settings-row settings-directory-row">
    <span><strong>{uiText("全局快速打开/关闭")}</strong><small>{uiText("点击输入框按下组合键，保存后立即生效。")}</small></span>
    <div className="global-shortcut-control">
      <div className="settings-directory-control">
        <Input aria-label={uiText("全局快速打开/关闭")} value={draft} disabled={busy}
          onChange={event => { setDraft(event.target.value); setError(""); }}
          onKeyDown={event => {
            event.stopPropagation();
            if (event.key === "Tab" && !event.ctrlKey && !event.altKey && !event.metaKey) return;
            if (event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.metaKey) { setDraft(saved); setError(""); return; }
            if (event.key === "Enter" && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); void save(draft); return; }
            const shortcut = shortcutFromEvent(event);
            if (shortcut && (event.ctrlKey || event.altKey || event.metaKey)) { event.preventDefault(); setDraft(shortcut); setError(""); }
          }} />
        <Button loading={busy} disabled={draft === saved} onClick={() => void save(draft)}>{uiText("保存")}</Button>
        <Button disabled={busy || saved === DEFAULT_GLOBAL_SHORTCUT} onClick={() => void save(DEFAULT_GLOBAL_SHORTCUT)}>{uiText("恢复默认")}</Button>
      </div>
      {error ? <small className="shortcut-setting-error" role="alert">{error}</small> : null}
    </div>
  </div>;
}
