export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href="/"
      className="brand"
      aria-label="Muse Invite Hub home"
      tabIndex={compact ? -1 : undefined}
    >
      <svg viewBox="0 0 40 40" width="37" height="37" aria-hidden="true">
        <rect width="40" height="40" rx="12" fill="currentColor" />
        <path d="M9 13h22v16H9z" fill="white" />
        <path
          d="m9 13 11 9 11-9"
          fill="none"
          stroke="#6941e0"
          strokeWidth="2.5"
        />
        <path d="m15 29 5-5 5 5" fill="none" stroke="#6941e0" strokeWidth="2" />
      </svg>
      {!compact && (
        <span>
          Muse<span className="brand-light"> Invite Hub</span>
        </span>
      )}
    </a>
  );
}
export function InvitationArt() {
  return (
    <div className="invitation-art" aria-hidden="true">
      <span className="art-orbit orbit-one" />
      <span className="art-orbit orbit-two" />
      <div className="floating-note">A little boost, passed on.</div>
      <div className="invite-paper">
        <div className="paper-top">
          <Brand compact />
          <span>
            Someone saved
            <br />a little for you.
          </span>
        </div>
        <div className="paper-title">
          More room
          <br />
          to explore.
        </div>
        <div className="paper-rule" />
        <div className="paper-code">YOU + MUSE</div>
        <div className="paper-bottom">
          <span>
            One share.
            <br />
            Two fresh starts.
          </span>
          <svg viewBox="0 0 64 64" width="54" height="54">
            <path
              d="M12 32h38m-14-14 14 14-14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
          </svg>
        </div>
      </div>
      <div className="art-stamp">
        <svg viewBox="0 0 24 24" width="28" height="28">
          <path
            d="m12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z"
            fill="currentColor"
          />
        </svg>
        <span>Free to share</span>
      </div>
    </div>
  );
}
