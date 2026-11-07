import Link from "next/link";

export default function ReviewPage() {
  return (
    <main className="stack">
      <h2>Review</h2>
      <p>No open reviews. Uncertain observations will keep the original record and a separate correction.</p>
      <p className="fine">Nothing is waiting, so there is no invented queue item.</p>
      <Link href="/">Back to the overview</Link>
    </main>
  );
}
