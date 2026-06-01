import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@zalo-edu/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  define: {
    global: "window",
  },
  server: {
    host: "0.0.0.0",
  },
});
