"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="page"><div className="empty-state" role="alert">
    <h1>Camera records are temporarily unavailable</h1>
    <p>The last stored evidence could not be loaded. Missing observations remain unavailable.</p>
    <button className="button button-primary" onClick={reset}>Try again</button>
  </div></main>;
}
