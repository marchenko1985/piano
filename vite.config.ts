import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  base: "/piano/",
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        "debug-piano-keyboard": resolve(import.meta.dirname, "debug/piano-keyboard.html"),
        "debug-components": resolve(import.meta.dirname, "debug/components.html"),
      },
    },
  },
});
