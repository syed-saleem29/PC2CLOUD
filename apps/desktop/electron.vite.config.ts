import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    entry: "src/main/index.ts",
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    entry: "src/preload/index.ts",
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: resolve(__dirname),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "index.html"),
        },
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    plugins: [react()],
  },
});
