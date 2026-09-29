import { z } from "zod";
import { apiJson, errorResponse } from "@/lib/api-errors";
import { configuredLimit, enforceRateLimit } from "@/lib/api-common";
import { getCodes } from "@/lib/codes";
import { getTrustedClientIp, ipHash } from "@/lib/security";

const querySchema = z.object({
  group: z.enum(["main", "issues"]).default("main"),
  limit: z.coerce.number().int().min(1).max(20).default(8),
  cursor: z.string().max(512).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      group: url.searchParams.get("group") || undefined,
      limit: url.searchParams.get("limit") || undefined,
      cursor: url.searchParams.get("cursor") || undefined,
    });
    if (!parsed.success)
      return apiJson({ error: "Check the list filters and try again." }, 400);

    const ip = await getTrustedClientIp(request);
    if (!ip)
      return apiJson(
        { error: "The request could not be verified. Please try again later." },
        503,
      );
    await enforceRateLimit(
      `rl:list:${await ipHash(ip)}`,
      configuredLimit("RATE_LIMIT_LIST_PER_MINUTE", 60),
      60,
    );
    return apiJson(
      await getCodes(parsed.data.group, parsed.data.limit, parsed.data.cursor),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
