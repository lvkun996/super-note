import React from "react";
import ReactDOM from "react-dom/client";
import { getUiLanguage, LANGUAGE_KEY } from "../electron/uiLanguage";

document.documentElement.lang = getUiLanguage();
window.addEventListener("storage", (event) => {
  if (event.key === LANGUAGE_KEY && event.newValue !== getUiLanguage()) window.location.reload();
});

const isMindMapStyleWindow = window.location.hash === "#mindmap-style";
document.body.classList.toggle("mind-map-style-mode", isMindMapStyleWindow);
const root = ReactDOM.createRoot(document.getElementById("root")!);

async function mount() {
  if (isMindMapStyleWindow) {
    const [, { MindMapStyleWindow }] = await Promise.all([
      import("./features/mindmap/mindMapStylePanel.css"),
      import("./features/mindmap/MindMapStyleWindow"),
    ]);
    root.render(<React.StrictMode><MindMapStyleWindow /></React.StrictMode>);
    return;
  }

  const [{ default: App }] = await Promise.all([
    import("./App"),
    import("antd/dist/reset.css"),
    import("./styles.css"),
    import("./features/mindmap/mindMap.css"),
    import("./features/overlays/overlayStyles.css"),
  ]);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}

void mount();
