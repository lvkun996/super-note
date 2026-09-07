import { UndoOutlined } from "@ant-design/icons";
import { uiText } from "../../../electron/uiLanguage";

type ZoomIndicatorProps = {
  percent: number;
  onRestore: () => void;
};

export function ZoomIndicator({ percent, onRestore }: ZoomIndicatorProps) {
  return (
    <div className="file-zoom-indicator" role="status">
      <span className="file-zoom-value">{percent}%</span>
      <button type="button" className="file-zoom-reset" onClick={onRestore}>
        <UndoOutlined aria-hidden />
        {uiText("恢复")}
      </button>
    </div>
  );
}
