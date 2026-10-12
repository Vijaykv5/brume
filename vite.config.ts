import { defineConfig } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";

const nodeModulePath = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

const solanaPackage = /^@solana\/([^/]+)$/;

const solanaBrowserFallback = {
  name: "solana-worker-export-fallback",
  enforce: "pre" as const,
  resolveId(source: string, importer?: string) {
    const match = solanaPackage.exec(source);
    if (!match || !importer || importer.startsWith("\0")) return null;

    const importerPath = importer.startsWith("file:")
      ? fileURLToPath(importer)
      : importer.split("?")[0];
    let directory = dirname(importerPath);

    while (true) {
      const packageJsonPath = resolve(
        directory,
        "node_modules",
        "@solana",
        match[1],
        "package.json",
      );
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
        const exports = packageJson.exports;
        const rootExports = exports?.["."] ?? exports;
        const importEntry = (entry: unknown) =>
          typeof entry === "string"
            ? entry
            : typeof entry === "object" && entry !== null
              ? (entry as { import?: unknown }).import
              : undefined;

        // Keep packages with Worker-specific exports on Cloudflare's normal
        // resolution path. Fall back only when a package has no such export.
        if (
          importEntry(rootExports?.workerd) ||
          importEntry(rootExports?.worker) ||
          importEntry(rootExports?.["edge-light"])
        ) {
          return null;
        }

        const browserEntry = importEntry(rootExports?.browser);
        if (typeof browserEntry === "string") {
          return resolve(dirname(packageJsonPath), browserEntry);
        }
        return null;
      }

      const parent = dirname(directory);
      if (parent === directory) return null;
      directory = parent;
    }
  },
};

export default defineConfig({
  resolve: {
    // The Cloudflare plugin replaces Vite's export conditions with workerd
    // conditions. rpc-websockets only publishes browser/node conditions, so
    // point its exact root import at the web-standard browser implementation.
    alias: [
      {
        find: /^rpc-websockets$/,
        replacement: nodeModulePath(
          "./node_modules/rpc-websockets/dist/index.browser.mjs",
        ),
      },
    ],
  },
  plugins: [
    solanaBrowserFallback,
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
