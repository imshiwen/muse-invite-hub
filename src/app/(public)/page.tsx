import type { Metadata } from "next";
import {
  ArrowUpRight,
  Check,
  Copy,
  Settings2,
  Clock3,
  Info,
  ArrowLeftRight,
  Sparkles,
  Plus,
} from "lucide-react";
import { CodePool } from "@/components/code-pool";
import { initialCodes } from "@/lib/codes";
import { HomeContext } from "@/components/home-context";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    absolute: "Muse Invite Codes — Free Community Codes | Muse Invite Hub",
  },
  description:
    "Copy a free Muse invite code directly from the community list. See the reported 48-hour redemption window and 1 billion-token reward for both people.",
  alternates: { canonical: "/" },
};
const faqs = [
  [
    "Do I need an invite code to join Muse?",
    "No. A reward invite code is separate from joining Muse. Account eligibility, availability and any waitlist still depend on Muse. Join through the official service first, then check whether you can redeem a code.",
  ],
  [
    "What do we each get?",
    "Community reports describe 1 billion Muse tokens for the person redeeming and 1 billion for the person sharing. Check the current terms inside Muse; these rewards are not guaranteed by this site.",
  ],
  [
    "How long do I have to redeem?",
    "The community-reported window is within 48 hours of joining Muse. It is a window for your account, not a countdown on the code. The precise eligibility shown in Muse takes priority.",
  ],
  [
    "How many times can a code be used?",
    "The community-reported limit is up to 30 redemptions per code. We cannot see the true remaining amount. A code may be shared elsewhere, and a successful report does not reserve a place.",
  ],
  [
    "What if the code doesn’t work?",
    "Your account may be outside the reward window, have already redeemed a reward, or have an availability restriction. The code may also be unavailable. Check the message in Muse before trying another code.",
  ],
  [
    "Are Muse and Muse Code the same product?",
    "This site covers Meta’s personal AI agent Muse. Muse Code refers to a different developer-tool context. These reward codes are for the personal agent, not a terminal coding tool.",
  ],
  [
    "Can I sell a code here?",
    "No. This is a free community exchange. Paid offers, misleading submissions and requests for account credentials are not allowed.",
  ],
];
export default async function Home() {
  const initial = await initialCodes();
  return (
    <main id="main" className="tool-home">
      <div className="container tool-container">
        <header className="tool-intro">
          <div className="exchange-label">
            <span className="exchange-symbol">
              <ArrowLeftRight size={14} />
            </span>{" "}
            A community code exchange
          </div>
          <div className="tool-title-line">
            <h1>
              Muse invite codes<span className="heading-dot">.</span>
            </h1>
            <span className="tool-free">
              <Check size={13} /> Always free. No sign-in.
            </span>
          </div>
          <p>Copy a free code. Get 1 billion Muse tokens.*</p>
          <div className="tool-reward">
            <span>
              <Clock3 size={14} /> Redeem within 48 hours of joining Muse*
            </span>
            <a href="#home-sources">
              *Community-reported rules <Info size={12} />
            </a>
          </div>
        </header>
        <div className="tool-workspace">
          <section
            id="codes"
            className="tool-pool"
            aria-label="Muse invite code list"
          >
            <CodePool initial={initial} />
            <p className="owner-disclosure">
              The site owner may receive tokens when an owner-shared code is
              redeemed.
            </p>
            <p className="tool-pool-disclaimer">
              Codes are shared publicly and may be used elsewhere. A listing
              doesn’t guarantee a successful redemption.
            </p>
          </section>
          <aside className="tool-guide" aria-labelledby="quick-guide-title">
            <div className="reward-exchange">
              <span className="reward-exchange-label">
                <Sparkles size={15} /> A little boost for both of you
              </span>
              <div className="reward-pair">
                <div>
                  <span>You get</span>
                  <strong>1B</strong>
                  <span>Muse tokens*</span>
                </div>
                <span className="reward-connector" aria-hidden="true">
                  <ArrowLeftRight size={24} />
                </span>
                <div>
                  <span>They get</span>
                  <strong>1B</strong>
                  <span>Muse tokens*</span>
                </div>
              </div>
              <p>
                *Reported by the community. Eligibility and rewards are
                determined by Muse.
              </p>
            </div>
            <div className="redemption-note">
              <h2 id="quick-guide-title">Copy here. Redeem in Muse.</h2>
              <ol className="quick-steps">
                <li>
                  <span className="quick-step-icon">
                    <Copy size={17} />
                  </span>
                  <div>
                    <strong>Copy a code</strong>
                    <p>Pick any code from the list.</p>
                  </div>
                </li>
                <li>
                  <span className="quick-step-icon">
                    <Settings2 size={17} />
                  </span>
                  <div>
                    <strong>Open Muse settings</strong>
                    <p>Look for the invite-code redemption option.</p>
                  </div>
                </li>
                <li>
                  <span className="quick-step-icon">
                    <Check size={18} />
                  </span>
                  <div>
                    <strong>Paste and redeem</strong>
                    <p>
                      Check your eligibility in Muse, then let us know if it
                      worked.
                    </p>
                  </div>
                </li>
              </ol>
              <a href="/redeem" className="tool-guide-link">
                Full redemption guide <ArrowUpRight size={14} />
              </a>
              <div className="tool-guide-note">
                <strong>Not on Muse yet?</strong>
                <p>
                  Reward codes aren’t required to register. Start with the{" "}
                  <a href="/how-to-register">joining guide</a>, or read{" "}
                  <a href="#home-joining">what worked for me</a>.
                </p>
              </div>
              <div className="tool-guide-note">
                <strong>Already redeemed a code?</strong>
                <p>
                  Community reports describe one invite reward per person. You
                  can <a href="/share">share your own code</a> instead.
                </p>
              </div>
              <a href="/share" className="tool-share-link">
                <Plus size={16} /> Have a code? Pass it on.
              </a>
            </div>
          </aside>
        </div>
        <HomeContext />
        <section className="tool-faq" aria-labelledby="faq-title">
          <div className="tool-section-heading">
            <h2 id="faq-title">Questions about Muse invite codes</h2>
            <a href="/region-limits">
              Availability & restrictions <ArrowUpRight size={14} />
            </a>
          </div>
          <div className="faq-list">
            {faqs.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
