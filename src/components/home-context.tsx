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
          <span className="experience-badge">
            Site owner’s first-hand experience
          </span>
          <time dateTime="2026-09-28">September 28, 2026</time>
        </div>
        <h2 id="owner-experience-heading">
          How I started using Muse from a waitlisted account
        </h2>
        <p className="experience-start">
          <strong>Starting point:</strong> My existing Muse account was on the
          waitlist.
        </p>
        <ol className="experience-steps">
          <li>
            <span className="experience-step-number">1</span>
            <div>
              <h3>Open the cloud browser</h3>
              <p>
                I opened{" "}
                <a
                  href="https://browser.lexmount.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Lexmount
                </a>
                , a third-party cloud browser, and chose the entry shown as
                “Open Muse.ai” → “Run.”
              </p>
            </div>
          </li>
          <li>
            <span className="experience-step-number">2</span>
            <div>
              <h3>Sign in with the same account</h3>
              <p>
                I signed in to my existing, waitlisted Muse account and
                completed the age verification Muse showed.
              </p>
            </div>
          </li>
          <li>
            <span className="experience-step-number">3</span>
            <div>
              <h3>Try web, then iOS</h3>
              <p>
                I sent one message in Muse on the web, then opened the iOS app
                with the same account.
              </p>
            </div>
          </li>
        </ol>
        <div className="experience-result">
          <strong>My result</strong>
          <p>My account was usable in Muse’s iOS app.</p>
        </div>
        <p className="experience-limit">
          This is one result from my account on September 28, 2026. The sequence
          does not prove the browser caused access, and it is not a guarantee
          for other people.
        </p>
        <div className="experience-actions">
          <a className="button" href="/how-to-register#owner-experience">
            Read the full registration steps
          </a>
          <a href="/region-limits">Check Muse availability by region</a>
        </div>
      </section>

      <section
        className="home-share-invite"
        aria-label="Share your Muse invite code"
      >
        <div className="share-invite-copy">
          <h2>Your code could help the next person.</h2>
          <p>
            Give someone a token boost—and you could get one too. Community
            reports describe 1B tokens for each of you after an eligible
            redemption.
          </p>
          <small>
            Eligibility and rewards follow Muse’s current in-app terms.
          </small>
        </div>
        <div className="share-invite-action">
          <a className="button" href="/share">
            Share my Muse code
          </a>
          <small>
            No account needed here. Save your private management link.
          </small>
        </div>
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
