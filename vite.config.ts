import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";

export default defineConfig({
  resolve: {
    // The Cloudflare plugin replaces Vite's export conditions with workerd
    // conditions. rpc-websockets only publishes browser/node conditions, so
    // point its exact root import at the web-standard browser implementation.
    alias: [
      {
        find: /^rpc-websockets$/,
        replacement: fileURLToPath(
          new URL(
            "./node_modules/rpc-websockets/dist/index.browser.mjs",
            import.meta.url,
          ),
        ),
      },
    ],
  },
  plugins: [
    vinext({
      cache: { data: kvDataAdapter(), cdn: cdnAdapter() },
      images: { optimizer: imagesOptimizer() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
