import { useState } from "react";
import { uiText } from "../../electron/uiLanguage";

const WELCOME_MESSAGES = ["你想写些什么？", "灵感涌现", "记录此时"] as const;

export function WelcomeWorld() {
  const [message] = useState(() => WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)]);

  return (
    <div className="welcome-world" role="status" aria-label={uiText("欢迎页")}>
      <p>{uiText(message)}</p>
    </div>
  );
}
