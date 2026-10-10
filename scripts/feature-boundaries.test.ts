import { describe, expect, it } from "vitest";
import { featureBoundaries } from "./feature-boundaries";

function verify(imports: string[], graphModule = "/repo/src/features/mindmap/mindMapLayout.ts") {
  const hook = featureBoundaries().generateBundle as Function;
  const chunk = (fileName: string, facadeModuleId: string, modules: string[], imports: string[]) => ({ type: "chunk", fileName, facadeModuleId, modules: Object.fromEntries(modules.map(id => [id, {}])), imports });
  hook.call({ error: (message: string) => { throw new Error(message); } }, {}, {
    "app.js": chunk("app.js", "/repo/src/App.tsx", [], imports),
    "canvas.js": chunk("canvas.js", "/repo/src/features/canvas/CanvasView.tsx", [], []),
    "graph.js": chunk("graph.js", "/repo/src/features/mindmap/MindMapCanvasView.tsx", [graphModule], []),
  });
}

describe("emitted feature boundaries", () => {
  it("allows separate dynamic graph entries", () => expect(() => verify([])).not.toThrow());
  it("rejects a graph implementation in the initial static graph", () => expect(() => verify(["graph.js"])).toThrow("eagerly loads"));
  it("handles Windows module paths", () => expect(() => verify(["graph.js"], "D:\\repo\\src\\features\\mindmap\\MindMapLayer.tsx")).toThrow("eagerly loads"));
});
