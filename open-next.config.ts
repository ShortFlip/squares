import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config for MVP — no R2 caching, no image optimization
// Add incrementalCache: r2IncrementalCache later when needed
export default defineCloudflareConfig({});
