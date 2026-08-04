import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: [
      { find: /^react$/, replacement: path.resolve(process.cwd(), "node_modules/react") },
      { find: /^react\//, replacement: path.resolve(process.cwd(), "node_modules/react") + "/" },
      { find: /^react-dom$/, replacement: path.resolve(process.cwd(), "node_modules/react-dom") },
      { find: /^react-dom\//, replacement: path.resolve(process.cwd(), "node_modules/react-dom") + "/" },
    ],
  },
  test: {
    environment: "node",
  },
});
