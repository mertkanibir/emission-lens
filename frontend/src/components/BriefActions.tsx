"use client";

import { useState } from "react";

export function BriefActions({
  text,
  filename,
  reportSnapshot,
}: {
  text: string;
  filename: string;
  reportSnapshot?: {payload:string;signature:string};
}) {
  const [feedback, setFeedback] = useState<{ text: string; message: string } | null>(null);

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setFeedback({ text, message: "Report text copied. Review it before sharing." });
    } catch {
      setFeedback({
        text,
        message: "Clipboard access is unavailable. Download the text file instead.",
      });
    }
  }

  return (
    <div className="brief-actions">
      <div className="button-row">
        <form action="/api/brief/pdf" method="post">
          <input type="hidden" name="text" value={text} />
          {reportSnapshot ? <><input type="hidden" name="report" value={reportSnapshot.payload}/><input type="hidden" name="signature" value={reportSnapshot.signature}/></> : null}
          <input type="hidden" name="filename" value={filename.replace(/\.txt$/, ".pdf")} />
          <button className="button button-primary" type="submit">Download PDF report</button>
        </form>
        <form action="/api/brief" method="post">
          <input type="hidden" name="text" value={text} />
          <input type="hidden" name="filename" value={filename} />
          <button className="button" type="submit">
            Download full text
          </button>
        </form>
        <button className="button" type="button" onClick={copy}>
          Copy report text
        </button>
      </div>
      <p className="fine" role="status" aria-live="polite">
        {feedback
          ? feedback.text === text
            ? feedback.message
            : "Report updated. Copy again or download the current version."
          : "Download saves locally. No email, posting, or automatic sending."}
      </p>
    </div>
  );
}
