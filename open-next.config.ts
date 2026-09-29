import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// All mutable routes are dynamic/no-store. No R2 or remote cache is required.
export default defineCloudflareConfig();
