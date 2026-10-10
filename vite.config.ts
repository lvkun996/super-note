import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { featureBoundaries } from "./scripts/feature-boundaries";

export default defineConfig({
  base: "./",
  plugins: [react(), featureBoundaries()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
