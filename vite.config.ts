import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

const root = import.meta.dirname;

const debugEntries = Object.fromEntries(
  readdirSync(resolve(root, "debug"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => [`debug-${f.replace(".html", "")}`, resolve(root, "debug", f)]),
);

/** Root-level HTML pages (games/tools) excluding index.html. */
const pageEntries = Object.fromEntries(
  readdirSync(root)
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .map((f) => [f.replace(".html", ""), resolve(root, f)]),
);

export default defineConfig({
  base: "/piano/",
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        ...pageEntries,
        ...debugEntries,
      },
    },
  },
});
