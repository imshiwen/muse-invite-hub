export function HomeContext() {
  return (
    <section
      className="home-context"
      aria-label="About Muse invite codes and this code pool"
    >
      <div className="context-grid">
        <section className="context-block" aria-labelledby="what-is-muse-code">
          <h2 id="what-is-muse-code">What is a Muse invite code?</h2>
          <p>
            A Muse invite code, sometimes called a referral code, can be entered
            for a token reward in Meta’s personal AI agent, Muse. Someone who
            already has access can share a code for another Muse user to try in
            the app. It is not a registration pass, a way off the waitlist, or a
            requirement for joining. These codes are for the personal agent, not
            the separate Muse Code programming tool. See the{" "}
            <a href="/how-to-register">joining guide</a> and{" "}
            <a href="/redeem">redemption guide</a> for the separate steps.
          </p>
        </section>

        <section className="context-block" aria-labelledby="code-pool-method">
          <h2 id="code-pool-method">How we maintain this code pool</h2>
          <p>
            Codes are labeled by how they reached the pool: shared by the site
            owner, submitted by a visitor, or collected and added by the site
            owner. Status summarizes reports from people who tried a code; it is
            not an official Muse check or a guarantee for your account.
          </p>
          <dl className="context-status-list">
            <dt>Not yet confirmed</dt>
            <dd>No success report is currently recorded here.</dd>
            <dt>No recent success reports</dt>
            <dd>
              A past success report is recorded, but it is no longer recent.
            </dd>
            <dt>Recently reported working</dt>
            <dd>
              A recent visitor reported success; another account may differ.
            </dd>
            <dt>Recent reports of issues</dt>
            <dd>
              Visitors reported problems; this does not prove a code is full.
            </dd>
          </dl>
          <p>
            Copying a code here does not redeem it, reserve a place, or reduce
            its available redemptions. Only Muse can confirm whether a
            redemption is accepted. You can <a href="/share">share a code</a> or
            report how a code worked for you.
          </p>
        </section>
      </div>

      <section
        className="owner-experience"
        id="home-joining"
        aria-labelledby="owner-experience-heading"
      >
        <div className="owner-experience-heading">
          <span>Site owner’s experience</span>
          <time dateTime="2026-09-28">September 28, 2026</time>
        </div>
        <h2 id="owner-experience-heading">
          What worked for me when joining Muse?
        </h2>
        <div className="owner-experience-body">
          <p>
            I already had a waitlisted Muse account. I opened{" "}
            <a
              href="https://browser.lexmount.com/"
              target="_blank"
              rel="noreferrer"
            >
              Lexmount
            </a>
            , a third-party cloud browser, and signed in to the same Muse
            account. I completed the verification Muse showed and sent a message
            in the web interface. After that, the same account worked in the iOS
            app. This was one attempt; I have not repeated the test or
            established that the browser caused the change.
          </p>
        </div>
        <p className="context-link">
          <a href="/how-to-register#owner-experience">
            Read the full account and its limits
          </a>
        </p>
      </section>

      <section
        className="source-summary"
        id="home-sources"
        aria-labelledby="home-sources-heading"
      >
        <h2 id="home-sources-heading">Sources behind this guidance</h2>
        <ul className="source-lines">
          <li>
            <strong>Official product announcement</strong>{" "}
            <a
              href="https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/"
              target="_blank"
              rel="noreferrer"
            >
              Meta describes Muse as its personal AI agent
            </a>
            . That announcement does not establish current account access or
            invite-reward terms.
          </li>
          <li>
            <strong>Community reward rules</strong> Reward details shown here
            are community reports, not independently verified official terms.
            Muse’s current in-app rules and eligibility take priority.
          </li>
          <li>
            <strong>Site-owner experience</strong> My dated, first-hand report
            above is one observation, not an independently verified result.{" "}
            <a href="/how-to-register#owner-experience">Read the full notes</a>.
          </li>
        </ul>
      </section>
    </section>
  );
}
