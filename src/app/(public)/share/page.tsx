import type { Metadata } from "next";
import { ShareForm } from "@/components/share-form";
import { LockKeyhole, HeartHandshake, Link2 } from "lucide-react";
export const metadata: Metadata = {
  title: "Share Your Muse Invite Code",
  description:
    "Pass your spare Muse invite code to the community. No account needed here. Save your private link to manage your submission.",
  alternates: { canonical: "/share" },
};
export default function Share() {
  return (
    <main id="main" className="container form-page">
      <nav className="breadcrumb">
        <a href="/">Home</a>
        <span>/</span>
        <span>Share a code</span>
      </nav>
      <div className="form-page-grid">
        <div className="form-intro">
          <span className="eyebrow">A small act of sharing</span>
          <h1>
            Leave a little
            <br />
            for the next person.
          </h1>
          <p className="lead">
            Share your Muse invite code with the community. No account needed
            here, and no charge to anyone.
          </p>
          <div className="feature-list">
            <div>
              <HeartHandshake />
              <p>
                <strong>Only real, freely shared codes.</strong>
                <span>
                  Codes come from people who have joined Muse. There is no
                  invite-code generator.
                </span>
              </p>
            </div>
            <div>
              <Link2 />
              <p>
                <strong>Your code. Your private link.</strong>
                <span>
                  After submitting, save the management link. You can update or
                  pause your code anytime.
                </span>
              </p>
            </div>
            <div>
              <LockKeyhole />
              <p>
                <strong>No account details, please.</strong>
                <span>
                  We only need the invite code. Never send us your password,
                  payment details or verification codes.
                </span>
              </p>
            </div>
          </div>
        </div>
        <ShareForm />
      </div>
    </main>
  );
}
