// Type-only contract: the plain board must not import the graph implementation.
export type MindMapCanvasRuntime = {
  MindMapLayer: typeof import("./MindMapLayer").MindMapLayer;
  MindMapRelationsLayer: typeof import("./MindMapRelationsLayer").MindMapRelationsLayer;
  resolveMindMapCanvasLinkAnchors: typeof import("./mindMapRelations").resolveMindMapCanvasLinkAnchors;
};
