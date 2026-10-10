import type { Plugin } from "vite";

const graphImplementations = /\/features\/mindmap\/(MindMapLayer|MindMapRelationsLayer|mindMapLayout|mindMapRelations)\.(tsx?|css)$/;

// Check actual emitted static dependencies, not file names or manual chunk hints.
export function featureBoundaries(): Plugin {
  return {
    name: "super-note-feature-boundaries",
    apply: "build",
    generateBundle(_, bundle) {
      for (const suffix of ["/src/App.tsx", "/src/features/canvas/CanvasView.tsx"]) {
        const entry = Object.values(bundle).find(output => output.type === "chunk" &&
          [output.facadeModuleId, ...Object.keys(output.modules)].some(id => id?.replaceAll("\\", "/").endsWith(suffix)));
        if (!entry || entry.type !== "chunk") this.error(`Missing feature entry: ${suffix}`);
        const pending = [entry.fileName], seen = new Set<string>();
        while (pending.length) {
          const name = pending.pop()!;
          if (seen.has(name)) continue;
          seen.add(name);
          const chunk = bundle[name];
          if (!chunk || chunk.type !== "chunk") continue;
          for (const moduleId of Object.keys(chunk.modules)) {
            if (graphImplementations.test(moduleId.replaceAll("\\", "/"))) this.error(`${suffix} eagerly loads mind-map implementation: ${moduleId}`);
          }
          pending.push(...chunk.imports);
        }
      }
    },
  };
}
