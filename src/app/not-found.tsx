import { Header, Footer } from "@/components/shell";
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="container simple-state">
        <span className="eyebrow">404</span>
        <h1>This invitation leads nowhere.</h1>
        <p>The page may have moved, or the link might be incomplete.</p>
        <a href="/" className="button">
          Back to the code pool
        </a>
      </main>
      <Footer privatePage />
    </>
  );
}
