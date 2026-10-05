// @ts-check
import { defineConfig } from "astro/config";

// Static site: `npm run build` writes plain HTML, CSS and JS to dist/.
export default defineConfig({
  devToolbar: { enabled: false },
  // In development, /api/* goes to the local Worker started by `npm run dev:api`.
  vite: { server: { proxy: { "/api": "http://127.0.0.1:8787" } } },
});
