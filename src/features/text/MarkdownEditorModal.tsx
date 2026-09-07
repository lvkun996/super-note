import { uiText } from "../../../electron/uiLanguage";
import { Button, Modal } from "antd";
import type { ReactNode } from "react";

type MarkdownEditorModalProps = {
  open: boolean;
  title: string;
  source: ReactNode;
  preview: ReactNode;
  onClose: () => void;
};

export function MarkdownEditorModal({ open, title, source, preview, onClose }: MarkdownEditorModalProps) {
  return (
    <Modal
      className="markdown-editor-modal"
      title={
        <div className="markdown-editor-modal-heading">
          <strong>{uiText("编辑 Markdown")}</strong>
          <span>{title}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      width="min(1120px, calc(100vw - 36px))"
      centered
      destroyOnHidden
      footer={<Button type="primary" onClick={onClose}>{uiText("完成")}</Button>}
    >
      <div className="markdown-editor-modal-labels" aria-hidden="true">
        <span>{uiText("编辑")}</span>
        <span>{uiText("实时预览")}</span>
      </div>
      <div className="markdown-editor-layout">
        <div className="markdown-source-pane">{source}</div>
        <div className="markdown-live-pane">{preview}</div>
      </div>
    </Modal>
  );
}
