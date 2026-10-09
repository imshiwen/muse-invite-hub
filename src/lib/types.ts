export type CodeStatus =
  "active" | "uncertain" | "likely_unavailable" | "retired";
export type PublicCode = {
  id: string;
  code: string;
  status: CodeStatus;
  source: string;
  remaining: number | null;
  remaining_at: string | null;
  created_at: string;
  last_success: string | null;
  work_count: number;
  copy_count: number;
};
export type ManagedCode = PublicCode & {
  moderation: string;
  retired_reason: string | null;
  review_note: string | null;
  fail_count: number;
};
export type CodePage = {
  codes: PublicCode[];
  cursor: string | null;
  total: number | null;
  unavailable?: boolean;
};
