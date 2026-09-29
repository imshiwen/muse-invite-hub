"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main id="main" className="container simple-state">
      <h1>We couldn’t load this page.</h1>
      <p>
        Your saved management link still works. Please try again in a moment.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
      <a href="/" className="button button-outline">
        Go home
      </a>
    </main>
  );
}
