import type { ReactNode } from "react";

export const SITE_URL = "https://museinvitehub.org";
export const SITE_NAME = "Muse Invite Hub";
export const OFFICIAL_MUSE_URL = "https://muse.ai/";
export const META_MUSE_ANNOUNCEMENT_URL =
  "https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/";
export const LEXMOUNT_URL = "https://browser.lexmount.com/";
export const SUPPORT_EMAIL = "support@museinvitehub.org";

export const CONTENT_PAGE_SLUGS = [
  "redeem",
  "how-to-register",
  "region-limits",
  "about",
  "privacy",
  "terms",
  "contact",
] as const;

export type ContentPageSlug = (typeof CONTENT_PAGE_SLUGS)[number];

export type ContentPage = {
  title: string;
  description: string;
  heading: string;
  intro: string;
  aside: ReactNode;
  body: ReactNode;
};

const communityRulesNotice = (
  <p className="source-note">
    Community-reported and unverified. Check the current terms in Muse.
  </p>
);

export const CONTENT_PAGES = {
  redeem: {
    title: "How to Redeem a Muse Invite Code | Muse Invite Hub",
    description:
      "Learn what a Muse invite code is for, what community-reported rewards may apply, and what is still unverified about redemption steps.",
    heading: "How to redeem a Muse invite code",
    intro:
      "A reward invite code is for someone who can already use Muse. It is separate from joining Muse, and neither a code nor this directory can guarantee a reward.",
    aside: (
      <div className="callout">
        <h2>Already joined Muse?</h2>
        <p>
          Start with the current instructions in Muse. If you still need access,
          read <a href="/how-to-register">how to join Muse</a> first.
        </p>
      </div>
    ),
    body: (
      <>
        <section aria-labelledby="redeem-before">
          <h2 id="redeem-before">Before you try a code</h2>
          <ul>
            <li>
              You need to have access to Muse already. An invite code is not a
              sign-up code or a way to bypass a waitlist.
            </li>
            <li>
              The code pool does not show live Muse inventory. A displayed code
              may stop working, and this site cannot check your account’s reward
              eligibility.
            </li>
            <li>
              Do not share your Muse password, verification code, payment
              details, or account information with this site.
            </li>
          </ul>
        </section>

        <section aria-labelledby="redeem-steps">
          <h2 id="redeem-steps">Steps to try</h2>
          <p>
            Menu labels may vary by platform and version; follow the prompts in
            Muse.
          </p>
          <ol className="steps">
            <li>
              Open Muse in the app or on the official Muse site and confirm that
              you are signed in to an account that can use Muse.
            </li>
            <li>
              Look in the current settings for an invite-code redemption option.
              One previously reported route is{" "}
              <strong>Settings → General → Redeem Invite Code</strong>. Menu
              labels may vary by platform and version; follow the prompts in
              Muse.
            </li>
            <li>
              Copy a code from the <a href="/">public code list</a>, enter it in
              Muse, and rely on Muse’s own response to tell you whether it was
              accepted.
            </li>
            <li>
              If the app rejects it, you can leave a “Didn’t work” report here.
              That only tells us someone reported a problem; it does not prove
              that a code is full or invalid for every account.
            </li>
          </ol>
        </section>

        <section aria-labelledby="redeem-rules">
          <h2 id="redeem-rules">Reward details are community-reported</h2>
          <p>
            Community reports mention a 48-hour redemption window after joining,
            up to 1 billion tokens for each side, up to 30 uses per code, and
            one reward per recipient. These rules are unverified, the event that
            starts the 48-hour window is unclear, and terms may change or vary
            by account.
          </p>
          {communityRulesNotice}
          <p>
            Treat the current in-app terms and eligibility message as the
            authority. This site does not count down your window, reserve a
            code, confirm a reward, or translate tokens into a cash value.
          </p>
        </section>

        <section aria-labelledby="redeem-faq">
          <h2 id="redeem-faq">Common questions</h2>
          <h3>Does an invite code get me off the waitlist?</h3>
          <p>
            No. This site has no evidence that a reward code grants sign-up
            access. Check Muse’s official entry point for current availability.
          </p>
          <h3>Does “Didn’t work” mean the code is full?</h3>
          <p>
            No. The report records one person’s result. We do not ask for a
            reason, and the same code may behave differently for another account
            or at another time.
          </p>
          <h3>Can I use the same reward more than once?</h3>
          <p>
            Community reports say one reward per recipient, but this has not
            been independently verified. Check Muse before relying on it.
          </p>
        </section>
      </>
    ),
  },
  "how-to-register": {
    title:
      "How to Join Muse: Official Entry and Invite Codes | Muse Invite Hub",
    description:
      "Find Muse’s official entry point, understand the difference between joining and redeeming a reward code, and read one clearly labeled owner-reported experience.",
    heading: "How to join Muse",
    intro:
      "Start with Muse’s official site and follow the availability and verification prompts shown for your account. A reward invite code is not required just to try to join.",
    aside: (
      <div className="callout">
        <h2>Official entry point</h2>
        <p>
          Meta’s launch announcement links to Muse at muse.ai. The live sign-up
          flow and eligibility can change.
        </p>
        <p>
          <a href={OFFICIAL_MUSE_URL} target="_blank" rel="noreferrer">
            Visit the official Muse site
          </a>
        </p>
      </div>
    ),
    body: (
      <>
        <section aria-labelledby="join-steps">
          <h2 id="join-steps">Use the current official flow</h2>
          <ol className="steps">
            <li>
              Open{" "}
              <a href={OFFICIAL_MUSE_URL} target="_blank" rel="noreferrer">
                muse.ai
              </a>
              , which is linked from Meta’s official Muse announcement.
            </li>
            <li>
              Follow the sign-in, availability, waitlist, or verification steps
              that Muse currently presents. Meta’s announcement does not
              document every screen or guarantee access for every account or
              region.
            </li>
            <li>
              Use accurate information for any age, identity, or account
              verification. Do not invent a location or identity to try to gain
              access.
            </li>
            <li>
              If you already have access and want to try a reward code, see the
              separate <a href="/redeem">redemption guide</a>. Joining and
              redeeming a reward are different steps.
            </li>
          </ol>
          <p>
            Meta announced Muse’s rollout in the United States on iOS, Android,
            and muse.ai on September 8, 2026. That announcement is not a current
            account-level eligibility checker. See our notes on{" "}
            <a href="/region-limits">regional availability</a> before drawing
            conclusions about your account.
          </p>
        </section>

        <section aria-labelledby="owner-experience">
          <h2 id="owner-experience">Community-reported experience</h2>
          <div className="callout">
            <p>
              <strong>
                Site owner’s first-hand experience — September 28, 2026
              </strong>
            </p>
            <p>
              <strong>Source:</strong> The site owner’s own report.{" "}
              <strong>Status:</strong> One reported successful attempt; not
              independently verified or repeated.
            </p>
            <p>
              On September 28, 2026, I used the following sequence with the Muse
              account that had entered the waitlist the day before. These are
              the labels and steps I encountered then; the service may change.
            </p>
            <ol className="steps">
              <li>
                I opened{" "}
                <a href={LEXMOUNT_URL} target="_blank" rel="noreferrer">
                  Lexmount Browser
                </a>
                , a third-party cloud browser, and registered or signed in to
                that service.
              </li>
              <li>
                The cloud browser included an “Open Muse.ai” entry. I chose
                “Run” and signed in to my existing Muse account.
              </li>
              <li>
                I completed the age-verification flow shown by Muse, then sent
                one message in the web session.
              </li>
              <li>
                I returned to the Muse iOS app with the same account and found I
                could use it.
              </li>
            </ol>
            <p>
              This is one observation about my account on that date. I have not
              established that the browser caused the change, and I have not
              repeated or independently verified the result. It is not a
              guaranteed way to leave a waitlist. Availability and verification
              requirements may differ or change.
            </p>
            <p>
              Lexmount is a third-party service, not an official Muse
              registration link. Its relationship with Meta has not been
              verified by this site. Any verification should use accurate
              information that meets the service’s requirements.
            </p>
          </div>
        </section>

        <section aria-labelledby="invite-not-registration">
          <h2 id="invite-not-registration">
            An invite code is a separate reward step
          </h2>
          <p>
            This directory shares user-provided codes that may be used after
            joining Muse. It does not issue or generate codes, decide who can
            join, or verify rewards. The reported reward window and amounts are
            community-reported; see the <a href="/redeem">redemption guide</a>{" "}
            for the limits of that information.
          </p>
        </section>
      </>
    ),
  },
  "region-limits": {
    title: "Muse Availability by Region: What Is Confirmed | Muse Invite Hub",
    description:
      "See what Meta has announced about Muse availability, what remains unknown, and how to check your account without relying on location workarounds.",
    heading: "Muse availability and regional limits",
    intro:
      "Availability can depend on Muse’s current rollout and account checks. The public announcement gives a dated launch snapshot, not a complete list of every eligible location.",
    aside: (
      <div className="callout">
        <h2>Check the source directly</h2>
        <p>
          Use the current official Muse site or app for account-specific
          availability. This independent site cannot check your eligibility.
        </p>
        <a href={OFFICIAL_MUSE_URL} target="_blank" rel="noreferrer">
          Open Muse
        </a>
      </div>
    ),
    body: (
      <>
        <section aria-labelledby="official-rollout">
          <h2 id="official-rollout">What the official announcement says</h2>
          <p>
            Meta’s September 8, 2026 announcement said Muse was rolling out in
            the United States on iOS, Android, and muse.ai. The announcement
            does not provide a complete, continuously updated country list or
            explain every account-level eligibility decision.
          </p>
          <p>
            <a
              href={META_MUSE_ANNOUNCEMENT_URL}
              target="_blank"
              rel="noreferrer"
            >
              Read Meta’s Muse launch announcement
            </a>
            . Check Muse itself for current availability; an older launch notice
            may not describe a later rollout.
          </p>
        </section>

        <section aria-labelledby="region-errors">
          <h2 id="region-errors">If Muse says it is unavailable</h2>
          <ul>
            <li>
              Read the message in Muse and check its current official help or
              entry page. A code from this directory cannot change regional
              eligibility.
            </li>
            <li>
              Do not assume that a waitlist, sign-in error, or failed code has
              one specific cause. This site cannot see or diagnose your Muse
              account.
            </li>
            <li>
              Use accurate location and identity details for any verification.
              We do not recommend inventing a location or using a code as a
              regional-access workaround.
            </li>
          </ul>
        </section>

        <section aria-labelledby="reported-case">
          <h2 id="reported-case">
            One owner-reported case is not a region rule
          </h2>
          <p>
            The site owner reported one September 28, 2026 experience using a
            third-party cloud browser with an existing waitlisted account; the
            same account later worked on web and iOS. The cause is unknown, and
            one report does not show whether access will work for someone else.
            Read the full, dated note on{" "}
            <a href="/how-to-register">how to join Muse</a>.
          </p>
        </section>
      </>
    ),
  },
  about: {
    title: "About Muse Invite Hub: An Independent Community Directory",
    description:
      "Learn what Muse Invite Hub does, what it cannot verify, and how it separates official sources from community-reported information.",
    heading: "About Muse Invite Hub",
    intro:
      "Muse Invite Hub is an independent directory for sharing free Muse reward invite codes and practical, source-labeled guidance.",
    aside: (
      <div className="callout">
        <h2>Independent community site</h2>
        <p>
          Muse Invite Hub is not affiliated with or endorsed by Meta. Muse and
          related marks belong to their respective owners.
        </p>
      </div>
    ),
    body: (
      <>
        <section aria-labelledby="what-we-do">
          <h2 id="what-we-do">What this site does</h2>
          <p>
            People can share a code they are allowed to share, and visitors can
            copy a publicly listed code and try it in Muse. We do not sell,
            create, or redeem codes; operate Muse accounts; or decide who is
            eligible for Muse or its rewards.
          </p>
          <p>
            Code status and any remaining amount are not live Muse inventory.
            Sharer-reported amounts are labeled as such. A success report means
            a visitor said a code worked; it is not an official confirmation of
            a redemption or reward.
          </p>
        </section>

        <section aria-labelledby="source-method">
          <h2 id="source-method">How we label information</h2>
          <ul>
            <li>
              <strong>Official:</strong> linked to a source published by Meta or
              Muse. Official announcements may still become outdated.
            </li>
            <li>
              <strong>Site-owner experience:</strong> a dated first-person
              account from the site owner, clearly separated from official
              instructions and without a success guarantee.
            </li>
            <li>
              <strong>Community-reported:</strong> information reported by users
              or the community that this site has not independently verified.
            </li>
          </ul>
          <p>
            We update a claim when we have new evidence. Missing evidence is
            labeled as unknown rather than filled with an estimate. Our{" "}
            <a href="/redeem">redemption guide</a> keeps reported reward terms
            separate from confirmed product information.
          </p>
        </section>

        <section aria-labelledby="independence">
          <h2 id="independence">No affiliation or endorsement</h2>
          <p>
            This site is not affiliated with or endorsed by Meta. A link to
            another service does not mean that the service sponsors this
            directory.
          </p>
          <p>
            To report a correction or ask about the directory, contact{" "}
            <a href={"mailto:" + SUPPORT_EMAIL}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </>
    ),
  },
  privacy: {
    title: "Privacy Policy | Muse Invite Hub",
    description:
      "Read what Muse Invite Hub processes for code sharing, abuse prevention, analytics consent, and how long records are designed to be retained.",
    heading: "Privacy policy",
    intro:
      "This policy describes the information Muse Invite Hub uses to operate a public code directory, prevent abuse, and measure public-page activity.",
    aside: (
      <div className="callout">
        <h2>Questions about privacy?</h2>
        <p>
          Contact <a href={"mailto:" + SUPPORT_EMAIL}>{SUPPORT_EMAIL}</a>. Do
          not email passwords, verification codes, or private management links.
        </p>
      </div>
    ),
    body: (
      <>
        <p>
          This is an independent site, not a Meta service. It does not ask
          visitors to create an account. Public code submissions contain the
          code and an optional self-reported remaining amount; they do not
          require a name, email address, or social account.
        </p>

        <section aria-labelledby="privacy-collected">
          <h2 id="privacy-collected">Information used to run the site</h2>
          <ul>
            <li>
              <strong>Necessary anonymous browser identifier.</strong> A
              first-party, secure, HTTP-only, SameSite cookie can distinguish a
              browser environment for abuse prevention and feedback deduping. It
              is not proof of a person’s identity and is designed to expire
              after 90 days. The application stores a keyed digest rather than
              the cookie value.
            </li>
            <li>
              <strong>Security and rate-limit signals.</strong> The application
              may derive keyed HMAC summaries from a trusted network address,
              browser identifier, and limited user-agent information. Raw IP
              addresses are not stored in the application business database.
              Hosting and security providers may keep their own operational logs
              according to their settings.
            </li>
            <li>
              <strong>Code and feedback records.</strong> The site stores public
              codes, their moderation and display status, copy events, and
              visitors’ current “Worked” or “Didn’t work” feedback. Feedback is
              a report, not an official redemption record. A report form may use
              Cloudflare Turnstile to reduce automated abuse.
            </li>
            <li>
              <strong>Local preferences.</strong> A visitor’s choice of audience
              path can be remembered on the device for up to 30 days. A recent
              copied-code reminder stores a public code ID and time for up to 24
              hours, and is cleared after feedback or dismissal.
            </li>
          </ul>
        </section>

        <section aria-labelledby="privacy-retention">
          <h2 id="privacy-retention">Retention periods</h2>
          <ul>
            <li>
              Business events and IP/user-agent abuse-prevention summaries: 30
              days.
            </li>
            <li>
              A feedback subject digest and the current feedback: while the code
              remains in the system, then up to 90 days after permanent
              retirement. Feedback-linked IP/user-agent summaries are removed
              after 30 days.
            </li>
            <li>Administrator audit records: 180 days.</li>
            <li>
              Detailed reports: 90 days after the report has been handled.
            </li>
            <li>
              Unpublished submissions left unresolved: up to 90 days, after
              which they are designed to be deleted.
            </li>
            <li>
              Aggregated counts that no longer identify a browser or person may
              be kept for long-term operations.
            </li>
          </ul>
          <p>
            Hosting and security providers may keep their own operational logs
            according to their settings.
          </p>
        </section>

        <section aria-labelledby="privacy-analytics">
          <h2 id="privacy-analytics">Analytics and consent</h2>
          <p>
            When Google Analytics 4 (GA4) is configured, it is limited to public
            pages. It is not loaded on private management or administrator
            pages. Before any GA4 configuration or event, advanced Consent Mode
            sets <code>analytics_storage</code>, <code>ad_storage</code>,
            <code>ad_user_data</code>, and <code>ad_personalization</code> to
            denied. Accepting analytics changes only{" "}
            <code>analytics_storage</code>; advertising-related states remain
            denied.
          </p>
          <p>
            Visitors in the EEA, United Kingdom, or Switzerland are shown a
            small choice banner. In other recognized regions, analytics defaults
            to allowed unless a visitor has saved a rejection. If the region
            cannot be determined, consent remains denied. An explicit rejection
            is retained for 180 days and takes precedence over a regional
            default.
          </p>
          <p>
            With analytics storage denied, Consent Mode may still send limited
            cookieless signals. Rejecting analytics therefore does not mean that
            no signal is sent. Google’s modeled reporting is not a record of
            individual visitors and is not guaranteed to fill in missing data.
          </p>
          <p>
            Public-page analytics measures visits and basic actions such as a
            successful clipboard copy, a submitted feedback result, a code
            submission result, or a click to Muse. Invite-code text, management
            links or tokens, visitor digests, raw IP/UA summaries, report text,
            and contact details are not sent as analytics event data.
          </p>
        </section>

        <section aria-labelledby="privacy-third-parties">
          <h2 id="privacy-third-parties">
            Service providers and external links
          </h2>
          <p>
            The site may rely on Cloudflare for hosting and abuse protection,
            Neon for its application database, and Google for public-page
            analytics. Their processing is governed by their own policies and
            the site’s production configuration. Following an external Muse or
            third-party link takes you to a separate service.
          </p>
        </section>

        <section aria-labelledby="privacy-contact">
          <h2 id="privacy-contact">Contact</h2>
          <p>
            For a privacy question, write to{" "}
            <a href={"mailto:" + SUPPORT_EMAIL}>{SUPPORT_EMAIL}</a>. This is the
            public support address; the private administrator address is not
            published here.
          </p>
        </section>
      </>
    ),
  },
  terms: {
    title: "Terms of Use | Muse Invite Hub",
    description:
      "Terms for using Muse Invite Hub’s free community code directory, reporting code results, and protecting private management links.",
    heading: "Terms of use",
    intro:
      "Muse Invite Hub is a free community directory. These terms explain the limits of the codes and reports shown here and the care required for a private management link.",
    aside: (
      <div className="callout">
        <h2>Need help?</h2>
        <p>
          Contact <a href={"mailto:" + SUPPORT_EMAIL}>{SUPPORT_EMAIL}</a> or
          read the <a href="/privacy">privacy policy</a>.
        </p>
      </div>
    ),
    body: (
      <>
        <section aria-labelledby="terms-service">
          <h2 id="terms-service">What the service provides</h2>
          <p>
            The site lets people share codes they are authorized to share and
            lets others copy those public codes to try in Muse. It does not
            create or sell codes, operate Muse accounts, redeem codes for
            visitors, reserve access, or guarantee that a code will work or that
            a reward will arrive.
          </p>
          <p>
            Use the directory for free sharing. Do not offer codes for sale or
            paid exchange. The site may pause or remove submissions that appear
            to violate these rules or create abuse or safety concerns.
          </p>
        </section>

        <section aria-labelledby="terms-reports">
          <h2 id="terms-reports">Codes and visitor reports</h2>
          <p>
            Codes can become unavailable or behave differently by account,
            platform, region, or time. A sharer-reported remaining amount is not
            live inventory. A “Worked” report reflects what one visitor said;
            “Didn’t work” does not prove that a code is full. The site does not
            ask for a failure reason and does not claim to know why Muse
            rejected a code.
          </p>
          <p>
            Reward windows, token amounts, and per-code use limits mentioned on
            the site are community-reported unless linked to a current official
            source. Check Muse’s own terms and messages before acting on them.
          </p>
        </section>

        <section aria-labelledby="terms-submit">
          <h2 id="terms-submit">Submitting and managing a code</h2>
          <p>
            Submit only a code you have the right to share, and confirm that it
            is offered for free. A submission may be held for review, paused, or
            removed. No review time is promised.
          </p>
          <p>
            A private management link works like a credential: anyone who has it
            may be able to manage that submission. Save it somewhere secure and
            do not post or forward it. If it is lost, the site may not be able
            to recover it automatically. Do not send it to support unless the
            support team specifically asks through a verified process.
          </p>
        </section>

        <section aria-labelledby="terms-accounts">
          <h2 id="terms-accounts">Muse accounts and third-party services</h2>
          <p>
            You are responsible for following Muse’s own eligibility and account
            requirements and for using accurate information during verification.
            This independent directory is not affiliated with or endorsed by
            Meta. External services linked here have their own terms and privacy
            practices.
          </p>
        </section>

        <section aria-labelledby="terms-contact">
          <h2 id="terms-contact">Contact</h2>
          <p>
            Questions or corrections can be sent to{" "}
            <a href={"mailto:" + SUPPORT_EMAIL}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </>
    ),
  },
  contact: {
    title: "Contact Muse Invite Hub",
    description:
      "Contact Muse Invite Hub about a correction, code listing, privacy question, or site issue.",
    heading: "Contact Muse Invite Hub",
    intro:
      "Use the public support address for questions about the directory, code listings, corrections, or privacy.",
    aside: (
      <div className="callout">
        <h2>Protect your account</h2>
        <p>
          We do not need your Muse password, sign-in code, payment details, or
          private management link to answer a general question.
        </p>
      </div>
    ),
    body: (
      <>
        <section aria-labelledby="contact-email">
          <h2 id="contact-email">Email</h2>
          <p>
            Write to <a href={"mailto:" + SUPPORT_EMAIL}>{SUPPORT_EMAIL}</a>.
            This address is provided for public support; its ability to receive
            messages has not been confirmed by this site.
          </p>
        </section>
        <section aria-labelledby="contact-include">
          <h2 id="contact-include">What to include</h2>
          <p>
            Describe the page or public code listing and what needs attention.
            Do not include passwords, verification codes, private management
            links, full payment details, or sensitive account information.
          </p>
        </section>
        <section aria-labelledby="contact-corrections">
          <h2 id="contact-corrections">Product support</h2>
          <p>
            We cannot view Muse accounts, confirm eligibility, recover a lost
            management link automatically, or resolve a reward decision. For
            Muse account issues, use the official Muse site or in-app support.
          </p>
        </section>
      </>
    ),
  },
} satisfies Record<ContentPageSlug, ContentPage>;

export function getContentPage(slug: string): ContentPage | undefined {
  if (!Object.hasOwn(CONTENT_PAGES, slug)) return undefined;
  return CONTENT_PAGES[slug as ContentPageSlug];
}

export function getCanonicalUrl(slug: ContentPageSlug): string {
  return SITE_URL + "/" + slug;
}

export const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/share",
  ...CONTENT_PAGE_SLUGS.map((slug) => "/" + slug),
] as const;
