import React from "react";
import ReactDOM from "react-dom/client";

const isMindMapStyleWindow = window.location.hash === "#mindmap-style";
document.body.classList.toggle("mind-map-style-mode", isMindMapStyleWindow);
const root = ReactDOM.createRoot(document.getElementById("root")!);

async function mount() {
  if (isMindMapStyleWindow) {
    await import("./features/mindmap/mindMapStylePanel.css");
    const { MindMapStyleWindow } = await import("./features/mindmap/MindMapStyleWindow");
    root.render(<React.StrictMode><MindMapStyleWindow /></React.StrictMode>);
    return;
  }

  await Promise.all([
    import("antd/dist/reset.css"),
    import("./styles.css"),
    import("./features/mindmap/mindMap.css"),
  ]);
  const { default: App } = await import("./App");
  root.render(<React.StrictMode><App /></React.StrictMode>);
}

void mount();
