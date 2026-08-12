import { describe, expect, it } from "vitest";
import { createMindMap } from "./mindMapModel";
import { getMindMapBranchPath, layoutMindMap } from "./mindMapLayout";

const makeDocument = () => createMindMap({ x: 500, y: 300 }, (() => {
  const ids = ["root", "a", "b"];
  let index = 0;
  return () => ids[index++];
})());

describe("mind map layout", () => {
  it("places balanced branches on both sides of the root", () => {
    const layout = layoutMindMap(makeDocument());
    const root = layout.nodes.find((node) => node.node.id === "root")!;
    const first = layout.nodes.find((node) => node.node.id === "a")!;
    const second = layout.nodes.find((node) => node.node.id === "b")!;
    expect(first.x).toBeGreaterThan(root.x + root.width);
    expect(second.x + second.width).toBeLessThan(root.x);
    expect(layout.edges).toHaveLength(2);
  });

  it("places every branch on the right in logic layout", () => {
    const document = makeDocument();
    document.style.structure = "right";
    const layout = layoutMindMap(document);
    const root = layout.nodes.find((node) => node.node.id === "root")!;
    expect(layout.nodes.filter((node) => node.level === 1).every((node) => node.x > root.x + root.width)).toBe(true);
  });

  it("creates distinct SVG paths for each branch shape", () => {
    const edge = { startX: 0, startY: 10, endX: 100, endY: 50 };
    expect(getMindMapBranchPath(edge, "straight")).toContain(" L ");
    expect(getMindMapBranchPath(edge, "elbow")).toContain(" H ");
    expect(getMindMapBranchPath(edge, "curve")).toContain(" C ");
  });
});
