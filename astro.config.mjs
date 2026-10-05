// @ts-check
import { defineConfig } from "astro/config";

// Static site: `npm run build` writes plain HTML, CSS and JS to dist/.
export default defineConfig({
  devToolbar: { enabled: false },
});
