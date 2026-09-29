/** OpenNext copies .env files into its worker fallback module. Runtime secrets
 * must come only from Cloudflare bindings; local test credentials must not ship.
 * Public NEXT_PUBLIC_* values have already been compiled into client bundles.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
const target = ".open-next/cloudflare/next-env.mjs";
await readFile(target, "utf8"); // Fail if the adapter changes its output contract.
await writeFile(
  target,
  "export const production = {};\nexport const development = {};\nexport const test = {};\n",
);
const secrets = [];
for (const name of [
  ".env.local",
  ".env.production.local",
  ".env.production",
  ".env",
]) {
  try {
    const text = await readFile(name, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (
        m &&
        /(SECRET|KEY|DATABASE_URL|TOKEN)/.test(m[1]) &&
        !m[1].startsWith("NEXT_PUBLIC_") &&
        m[2].length >= 16
      )
        secrets.push(m[2].replace(/^['"]|['"]$/g, ""));
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.(m?js|json|html)$/.test(path)) {
      const text = await readFile(path, "utf8");
      if (secrets.some((s) => text.includes(s)))
        throw new Error("Build refused: local runtime secret found in " + path);
    }
  }
}
await scan(".open-next");
console.log(
  "Worker environment sanitized; no local runtime secrets in deployable JS/JSON/HTML.",
);
