import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// Pages remain dynamic; public code data uses the Worker Cache API.
// Private responses and mutations stay no-store. No R2 binding is required.
export default defineCloudflareConfig();
