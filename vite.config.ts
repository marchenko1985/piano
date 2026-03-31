import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        game: resolve(import.meta.dirname, "game.html"),
        practice: resolve(import.meta.dirname, "practice.html"),
      },
    },
  },
});
