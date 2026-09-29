import { Brand } from "./brand";
import { CookieSettings } from "./consent";
export function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="/#codes">Find a code</a>
          <a href="/redeem">How it works</a>
          <a href="/how-to-register">New to Muse?</a>
        </nav>
        <a className="button button-small button-outline" href="/share">
          Share your code <span aria-hidden="true">+</span>
        </a>
        <details className="mobile-menu">
          <summary aria-label="Open navigation">☰</summary>
          <nav aria-label="Mobile navigation">
            <a href="/#codes">Find a code</a>
            <a href="/redeem">How it works</a>
            <a href="/how-to-register">New to Muse?</a>
            <a href="/share">Share your code</a>
          </nav>
        </details>
      </div>
    </header>
  );
}
export function Footer({ privatePage = false }: { privatePage?: boolean }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <Brand />
            <p>Free community invite codes for Muse.</p>
          </div>
          <div className="footer-links">
            <a href="/how-to-register">Join Muse</a>
            <a href="/region-limits">Availability</a>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            Independent community site. Not affiliated with or endorsed by Meta.
          </p>
          <div>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            {!privatePage && <CookieSettings />}
          </div>
        </div>
      </div>
    </footer>
  );
}
