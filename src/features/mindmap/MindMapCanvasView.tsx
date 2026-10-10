import { CanvasView, type CanvasViewProps } from "../canvas/CanvasView";
import { MindMapLayer } from "./MindMapLayer";
import { MindMapRelationsLayer } from "./MindMapRelationsLayer";
import { resolveMindMapCanvasLinkAnchors } from "./mindMapRelations";
import type { MindMapCanvasRuntime } from "./mindMapCanvasRuntime";
import "./mindMap.css";

// A stable capability object avoids invalidating drag subscriptions on rerenders.
const runtime: MindMapCanvasRuntime = { MindMapLayer, MindMapRelationsLayer, resolveMindMapCanvasLinkAnchors };

export function MindMapCanvasView(props: Omit<CanvasViewProps, "mindMapRuntime">) {
  return <CanvasView {...props} mindMapRuntime={runtime} />;
}
