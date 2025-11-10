import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    globals: true,
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        singleWorker: true,
        isolatedStorage: false,
        miniflare: {
          // Disable worker threads to avoid path resolution issues on Windows
          compatibilityFlags: ["nodejs_compat"],
        },
      },
    },
  },
});
