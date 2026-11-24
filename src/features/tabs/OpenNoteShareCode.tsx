import { Button, Input, Modal } from "antd";
import type { InputRef } from "antd";
import { useRef, useState } from "react";
import { uiText } from "../../../electron/uiLanguage";
import type { NoteShareResult, SharedTextNote } from "../../../electron/noteShareCode";
import { readClipboardText } from "../editor/editorUtils";

export function noteShareError(result: NoteShareResult) {
  if (result.reason === "code-too-long") return uiText("口令最多 {0} 个字符，请缩短正文后重新生成", [result.maxLength]);
  if (result.reason === "too-large") return uiText("文本过大，口令最多支持 4 MB 的数据");
  if (result.reason === "unsupported") return uiText("此口令版本暂不支持");
  return uiText("口令无效或不完整");
}

export function OpenNoteShareCode({ onClose, onOpen }: { onClose: () => void; onOpen: (note: SharedTextNote) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<InputRef>(null);
  const decoding = useRef(false);

  const open = async () => {
    if (decoding.current || !code.trim()) return;
    decoding.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await window.superNote?.decodeNoteShareCode(code);
      if (result?.ok) onOpen(result.note);
      else setError(result ? noteShareError(result) : uiText("请在 Super Note 桌面应用中打开口令"));
    } catch {
      setError(uiText("打开口令失败"));
    } finally {
      decoding.current = false;
      setBusy(false);
    }
  };

  const paste = async () => {
    try {
      const text = await readClipboardText();
      setCode(text);
      setError(text.trim() ? "" : uiText("剪贴板没有可粘贴的文字"));
      input.current?.focus();
    } catch {
      setError(uiText("无法读取剪贴板"));
    }
  };

  return (
    <Modal
      open
      centered
      title={uiText("打开口令")}
      className="note-share-dialog"
      width={480}
      onCancel={() => { if (!decoding.current) onClose(); }}
      afterOpenChange={(visible) => { if (visible) input.current?.focus(); }}
      okText={uiText("打开")}
      cancelText={uiText("取消")}
      okButtonProps={{ disabled: !code.trim() }}
      cancelButtonProps={{ disabled: busy }}
      confirmLoading={busy}
      onOk={() => void open()}
    >
      <Input.TextArea
        ref={input}
        aria-label={uiText("文本口令")}
        placeholder={uiText("在此粘贴文本口令")}
        value={code}
        rows={4}
        spellCheck={false}
        disabled={busy}
        status={error ? "error" : undefined}
        onChange={(event) => { setCode(event.target.value); setError(""); }}
        onPressEnter={(event) => {
          if (!event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
            event.preventDefault();
            void open();
          }
        }}
      />
      <div className="note-share-dialog-tools">
        <Button size="small" disabled={busy} onClick={() => void paste()}>{uiText("从剪贴板粘贴")}</Button>
        {error && <span role="alert">{error}</span>}
      </div>
    </Modal>
  );
}
