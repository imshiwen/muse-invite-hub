import { getAdminIdentity } from "@/lib/security";
import { isLocal } from "@/lib/config";
import { AdminPanel, AdminLogin } from "@/components/admin-panel";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const identity = await getAdminIdentity().catch(() => null);
  return (
    <main id="main" className="container private-page">
      {identity ? (
        <AdminPanel local={identity.source === "local-session"} />
      ) : (
        <AdminLogin local={isLocal()} />
      )}
    </main>
  );
}
