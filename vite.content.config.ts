import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: resolve(__dirname, "src/content/index.ts"),
      output: {
        format: "iife",
        name: "FocusWhaleContent",
        entryFileNames: "assets/content.js",
        inlineDynamicImports: true,
        assetFileNames: (assetInfo) => {
          const sourceName = assetInfo.names[0] ?? "";
          if (sourceName === "focuswhale-atlas.png") {
            return "assets/focuswhale-atlas.png";
          }
          if (sourceName === "PretendardVariable.woff2") {
            return "assets/PretendardVariable.woff2";
          }
          return "assets/[name]-[hash][extname]";
        }
      }
    }
  }
});
