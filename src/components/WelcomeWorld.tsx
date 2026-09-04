import { uiText } from "../../electron/uiLanguage";
export function WelcomeWorld() {
  return (
    <div className="welcome-world" role="status" aria-label={uiText("欢迎页")}>
      <p>{uiText("你想让我们在")}<span>super-note</span>{uiText("中构建什么？")}</p>
    </div>
  );
}
