import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname), "");

  return {
    main: {
      entry: "src/main/index.ts",
      plugins: [externalizeDepsPlugin()],
      define: {
        "process.env.VITE_API_URL": JSON.stringify(env.VITE_API_URL || "http://localhost:7000"),
        "process.env.VITE_DASHBOARD_URL": JSON.stringify(env.VITE_DASHBOARD_URL || "http://localhost:8000"),
      },
      build: {
        rollupOptions: {
          output: { format: "cjs" },
        },
      },
    },
    preload: {
      entry: "src/preload/index.ts",
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          output: { format: "cjs" },
        },
      },
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
  };
});
