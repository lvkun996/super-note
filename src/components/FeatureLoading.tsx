import { uiText } from "../../electron/uiLanguage";

type FeatureLoadingProps = {
  label?: string;
};

export function FeatureLoading({ label = uiText("正在加载...") }: FeatureLoadingProps) {
  return (
    <div className="feature-loading" role="status" aria-live="polite">
      <span className="feature-loading-indicator" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
