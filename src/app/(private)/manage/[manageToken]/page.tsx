import { ManagePanel } from "@/components/manage-panel";
import { getManaged } from "@/lib/codes";
import type { ManagedCode } from "@/lib/types";
import { tokenHash } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function ManagePage({
  params,
}: {
  params: Promise<{ manageToken: string }>;
}) {
  const { manageToken } = await params;
  let codes: ManagedCode[] = [];
  try {
    codes = await getManaged(await tokenHash(manageToken));
  } catch {}
  if (codes.length)
    return (
      <main id="main" className="container private-page">
        <span className="eyebrow">Your private space</span>
        <h1>Keep your contribution up to date.</h1>
        <p className="lead">
          Update your estimate, pause your code, or pass along a new one.
        </p>
        <ManagePanel token={manageToken} initial={codes} />
      </main>
    );
  return (
    <main id="main" className="container simple-state">
      <h1>This management link isn’t available.</h1>
      <p>
        Check that you copied the complete link. It may have been replaced or
        expired, or the service may be temporarily unavailable.
      </p>
      <a href="/contact" className="button">
        Contact support
      </a>
      <a href="/" className="button button-outline">
        Back to the code pool
      </a>
    </main>
  );
}
