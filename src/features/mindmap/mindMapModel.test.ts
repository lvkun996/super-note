import { describe, expect, it } from "vitest";
import {
  addMindMapChild,
  addMindMapSibling,
  createMindMap,
  deleteMindMapBranch,
  linkMindMapNodeToCanvasItem,
  moveMindMapNode,
  normalizeMindMap,
  removeMindMapCanvasLinksForItem,
  toggleMindMapNode,
  updateMindMapCanvasLink,
} from "./mindMapModel";

function idFactory(...ids: string[]) {
  let index = 0;
  return () => ids[index++];
}

describe("mind map model", () => {
  it("creates a root and two starter branches", () => {
    const document = createMindMap({ x: 300, y: 240 }, idFactory("root", "a", "b"));
    expect(document.rootId).toBe("root");
    expect(document.nodes.map((node) => node.parentId)).toEqual([null, "root", "root"]);
    expect(document.originX).toBe(300);
  });

  it("adds child and sibling topics and deletes the complete branch", () => {
    const base = createMindMap({ x: 0, y: 0 }, idFactory("root", "a", "b"));
    const withChild = addMindMapChild(base, "a", () => "a-child").document;
    const withSibling = addMindMapSibling(withChild, "a-child", () => "a-sibling").document;
    expect(withSibling.nodes.filter((node) => node.parentId === "a").map((node) => node.id)).toEqual(["a-child", "a-sibling"]);
    expect(deleteMindMapBranch(withSibling, "a").nodes.map((node) => node.id)).toEqual(["root", "b"]);
  });

  it("expands a collapsed topic when a child is inserted", () => {
    const base = createMindMap({ x: 0, y: 0 }, idFactory("root", "a", "b"));
    const collapsed = toggleMindMapNode(addMindMapChild(base, "a", () => "child").document, "a");
    expect(collapsed.nodes.find((node) => node.id === "a")?.collapsed).toBe(true);
    const next = addMindMapChild(collapsed, "a", () => "child-2").document;
    expect(next.nodes.find((node) => node.id === "a")?.collapsed).toBe(false);
  });

  it("normalizes persisted spacing and keeps backward-compatible defaults", () => {
    const normalized = normalizeMindMap({
      rootId: "root",
      originX: 10,
      originY: 20,
      nodes: [{ id: "root", parentId: null, text: "Root" }],
      style: { horizontalGap: 999, verticalGap: 1 },
    });
    expect(normalized?.style.horizontalGap).toBe(180);
    expect(normalized?.style.verticalGap).toBe(10);
    expect(normalized?.style.branchShape).toBe("curve");
    expect(normalized?.canvasLinks).toEqual([]);
  });

  it("reorders siblings and reparents a branch", () => {
    const base = createMindMap({ x: 0, y: 0 }, idFactory("root", "a", "b"));
    const reordered = moveMindMapNode(base, "b", "a", "before");
    expect(reordered.nodes.filter((node) => node.parentId === "root").map((node) => node.id)).toEqual(["b", "a"]);
    const childDocument = addMindMapChild(reordered, "a", () => "child").document;
    const reparented = moveMindMapNode(childDocument, "b", "a", "child");
    expect(reparented.nodes.find((node) => node.id === "b")?.parentId).toBe("a");
    expect(moveMindMapNode(reparented, "a", "child", "child")).toBe(reparented);
  });

  it("stores unique canvas links, edits anchors, and migrates legacy image links", () => {
    const base = createMindMap({ x: 0, y: 0 }, idFactory("root", "a", "b"));
    const linked = linkMindMapNodeToCanvasItem(base, "a", "text-1", () => "link-1");
    const duplicate = linkMindMapNodeToCanvasItem(linked, "a", "text-1", () => "link-2");
    expect(duplicate.canvasLinks).toEqual([{
      id: "link-1",
      nodeId: "a",
      itemId: "text-1",
      nodeAnchor: "auto",
      itemAnchor: "auto",
    }]);
    expect(updateMindMapCanvasLink(duplicate, "link-1", { nodeAnchor: "left", itemAnchor: "bottom" }).canvasLinks[0])
      .toMatchObject({ nodeAnchor: "left", itemAnchor: "bottom" });
    expect(removeMindMapCanvasLinksForItem(duplicate, "text-1").canvasLinks).toEqual([]);
    expect(deleteMindMapBranch(linked, "a").canvasLinks).toEqual([]);

    const legacy = normalizeMindMap({ ...base, canvasLinks: undefined, imageLinks: [{ id: "old", nodeId: "a", imageItemId: "image-1" }] });
    expect(legacy?.canvasLinks).toEqual([{
      id: "old",
      nodeId: "a",
      itemId: "image-1",
      nodeAnchor: "auto",
      itemAnchor: "auto",
    }]);
  });
});
