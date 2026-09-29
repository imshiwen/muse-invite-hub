export async function api<T = Record<string, unknown>>(
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({
    error: "The request could not be completed. Please try again.",
  }));
  if (!res.ok)
    throw new Error(
      data.error || "The request could not be completed. Please try again.",
    );
  return data as T;
}
let visitor: Promise<unknown> | undefined;
export function ensureVisitor() {
  return (visitor ??= api("/api/visitor", {}).catch((e) => {
    visitor = undefined;
    throw e;
  }));
}
export function makeToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
}
export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
export async function copyText(text: string) {
  if (!navigator.clipboard)
    throw new Error(
      "Select and copy the code below. Your browser does not allow automatic copying.",
    );
  await navigator.clipboard.writeText(text);
}

// Storage may be unavailable in private/restricted browsers. Keep in-flight
// credentials in memory so a failed storage write never blocks a submission.
const temporary = new Map<string, string>();
export function temporaryGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? temporary.get(key) ?? null;
  } catch {
    return temporary.get(key) ?? null;
  }
}
export function temporarySet(key: string, value: string) {
  temporary.set(key, value);
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* In-memory retry remains available. */
  }
}
export function temporaryRemove(key: string) {
  temporary.delete(key);
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* No persistent value was written. */
  }
}
