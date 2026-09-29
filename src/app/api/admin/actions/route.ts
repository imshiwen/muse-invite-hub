import { handleAdminAction } from '@/lib/admin-api';

export async function POST(request: Request) {
  return handleAdminAction(request);
}
