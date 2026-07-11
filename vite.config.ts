import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background/index.ts"),
        popup: resolve(__dirname, "src/pages/popup/index.html"),
        options: resolve(__dirname, "src/pages/options/index.html"),
        blocked: resolve(__dirname, "src/pages/blocked/index.html"),
        onboarding: resolve(__dirname, "src/pages/onboarding/index.html")
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
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
