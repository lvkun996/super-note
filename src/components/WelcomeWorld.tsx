import { uiText } from "../../electron/uiLanguage";
export function WelcomeWorld() {
  return (
    <div className="welcome-world" role="status" aria-label={uiText("欢迎页")}>
      <p>{uiText("你想写些什么？")}</p>
    </div>
  );
}
