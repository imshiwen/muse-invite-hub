import nextWorker from "./.open-next/worker.js";
import { neon } from "@neondatabase/serverless";
// Preserve adapter exports if its cache implementation adds a Durable Object.
export * from "./.open-next/worker.js";
const worker = {
  fetch: nextWorker.fetch,
  async scheduled(_controller, env) {
    // Local previews never connect to a remote database or run cleanup implicitly.
    if (env.APP_ENV !== "production") return;
    if (!env.DATABASE_URL)
      throw new Error("Scheduled cleanup: database is not configured.");
    try {
      await neon(env.DATABASE_URL).query("SELECT hub_cleanup()");
    } catch {
      // Do not surface database URLs, parameters or raw database error text.
      throw new Error(
        "Scheduled cleanup failed. Check database health and migration status.",
      );
    }
  },
};

export default worker;
