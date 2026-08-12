import { describe, expect, it } from "vitest";
import type { CanvasViewState, ImageCanvasItem, TextCanvasItem } from "../../appTypes";
import { createMindMap, linkMindMapNodeToCanvasItem, updateMindMapCanvasLink } from "./mindMapModel";
import {
  getMindMapCanvasLinkAnchorAtPoint,
  layoutMindMapCanvasRelations,
  resolveMindMapCanvasLinkAnchors,
} from "./mindMapRelations";

describe("mind map canvas relations", () => {
  it("connects a topic edge to the linked image edge", () => {
    const ids = ["root", "a", "b"];
    let index = 0;
    const document = linkMindMapNodeToCanvasItem(
      createMindMap({ x: 300, y: 160 }, () => ids[index++]),
      "a",
      "image",
      () => "link",
    );
    const image: ImageCanvasItem = {
      id: "image",
      type: "image",
      x: 250,
      y: 420,
      width: 320,
      height: 220,
      src: "data:image/png;base64,",
      name: "image.png",
    };
    const viewState: CanvasViewState = { scale: 1, panX: 0, panY: 0, itemOverrides: {} };
    const relations = layoutMindMapCanvasRelations(document, [image], viewState);
    expect(relations).toHaveLength(1);
    expect(relations[0].path).toContain(" C ");
    expect(relations[0].endY).toBe(image.y);
  });

  it("links text and honors explicit attachment points and live overrides", () => {
    const ids = ["root", "a", "b"];
    let index = 0;
    const linked = linkMindMapNodeToCanvasItem(createMindMap({ x: 300, y: 160 }, () => ids[index++]), "a", "text", () => "link");
    const document = updateMindMapCanvasLink(linked, "link", { nodeAnchor: "right", itemAnchor: "left" });
    const text: TextCanvasItem = { id: "text", type: "text", x: 700, y: 280, width: 240, height: 80, text: "关联文字" };
    const viewState: CanvasViewState = { scale: 1, panX: 0, panY: 0, itemOverrides: { text: { x: 820, y: 340 } } };
    const relation = layoutMindMapCanvasRelations(document, [text], viewState)[0];
    expect(relation.endX).toBe(820);
    expect(relation.endY).toBe(380);
  });

  it("chooses the nearest side from the relation drop point", () => {
    const ids = ["root", "a", "b"];
    let index = 0;
    const document = linkMindMapNodeToCanvasItem(createMindMap({ x: 300, y: 160 }, () => ids[index++]), "a", "text", () => "link");
    const text: TextCanvasItem = { id: "text", type: "text", x: 700, y: 280, width: 240, height: 80, text: "关联文字" };
    const viewState: CanvasViewState = { scale: 1, panX: 0, panY: 0, itemOverrides: {} };
    const link = document.canvasLinks[0];
    expect(getMindMapCanvasLinkAnchorAtPoint(document, [text], viewState, link, "item", { x: 700, y: 320 })).toBe("left");
    expect(getMindMapCanvasLinkAnchorAtPoint(document, [text], viewState, link, "item", { x: 820, y: 270 })).toBe("top");
    expect(resolveMindMapCanvasLinkAnchors(document, [text], viewState, link)).toEqual({ nodeAnchor: "right", itemAnchor: "left" });
  });
});
