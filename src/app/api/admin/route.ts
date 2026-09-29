import { apiJson, errorResponse } from '@/lib/api-errors';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/security';
import { handleAdminAction } from '@/lib/admin-api';

export async function GET(request: Request) {
  try {
    const identity = await requireAdmin(request);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') || '100');
    const offset = Number(url.searchParams.get('offset') || '0');
    const moderationInput = url.searchParams.get('moderation');
    const moderation = moderationInput && ['pending', 'approved', 'needs_review', 'rejected'].includes(moderationInput) ? moderationInput : null;
    const statusInput = url.searchParams.get('status');
    const status = statusInput && ['active', 'uncertain', 'likely_unavailable', 'retired'].includes(statusInput) ? statusInput : null;
    const searchInput = url.searchParams.get('q')?.trim() || null;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200 || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000 || (moderationInput && !moderation) || (statusInput && !status)) {
      return apiJson({ error: 'Check the admin list filters and try again.' }, 400);
    }
    if (searchInput && searchInput.length > 64) return apiJson({ error: 'Search text must be 64 characters or fewer.' }, 400);
    const [codes, reports, stats, codeCount] = await Promise.all([
      query<Record<string, unknown>>(`
        SELECT id, code, status, source, remaining, remaining_at, created_at,
          last_success, work_count, copy_count, moderation, retired_reason,
          review_note, fail_count
        FROM code_state
        WHERE ($1::text IS NULL OR moderation=$1)
          AND ($2::text IS NULL OR id::text=$2 OR code ILIKE '%'||$2||'%')
          AND ($3::text IS NULL OR status=$3)
        ORDER BY CASE moderation WHEN 'pending' THEN 0 WHEN 'needs_review' THEN 1 ELSE 2 END, created_at DESC
        LIMIT $4 OFFSET $5
      `, [moderation, searchInput, status, limit, offset]),
      query<Record<string, unknown>>(`
        SELECT r.id, r.code_id, r.reason, r.note, r.created_at, r.resolved_at,
          c.code, c.moderation
        FROM abuse_reports r JOIN codes c ON c.id=r.code_id
        ORDER BY r.resolved_at NULLS FIRST, r.created_at DESC
        LIMIT 200
      `),
      query<Record<string, unknown>>(`
        SELECT
          (SELECT count(*)::int FROM submissions) AS submissions,
          (SELECT count(*)::int FROM codes) AS codes_total,
          (SELECT count(*)::int FROM codes WHERE moderation='pending') AS pending,
          (SELECT count(*)::int FROM codes WHERE moderation='approved') AS approved,
          (SELECT count(*)::int FROM codes WHERE moderation='needs_review') AS needs_review,
          (SELECT count(*)::int FROM codes WHERE moderation IN ('approved','needs_review') AND retired_reason IS NULL AND remaining IS DISTINCT FROM 0) AS public_codes,
          (SELECT count(*)::int FROM abuse_reports WHERE resolved_at IS NULL) AS open_reports
      `),
      query<{ total: number }>(`
        SELECT count(*)::int AS total FROM code_state
        WHERE ($1::text IS NULL OR moderation=$1)
          AND ($2::text IS NULL OR id::text=$2 OR code ILIKE '%'||$2||'%')
          AND ($3::text IS NULL OR status=$3)
      `, [moderation, searchInput, status]),
    ]);
    return apiJson({
      codes,
      reports,
      stats: stats[0] || {},
      codePagination: { limit, offset, total: Number(codeCount[0]?.total ?? 0) },
      local: identity.source === 'local-session',
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  return handleAdminAction(request);
}
