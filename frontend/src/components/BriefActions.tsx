"use client";

import { useState } from "react";

export function BriefActions({
  text,
  filename,
}: {
  text: string;
  filename: string;
}) {
  const [feedback, setFeedback] = useState("");

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setFeedback("Draft copied. Review it before sharing.");
    } catch {
      setFeedback(
        "Clipboard access is unavailable. Download the text file instead.",
      );
    }
  }

  return (
    <div className="brief-actions">
      <div className="button-row">
        <form action="/api/brief" method="post">
          <input type="hidden" name="text" value={text} />
          <input type="hidden" name="filename" value={filename} />
          <button className="button button-primary" type="submit">
            Download text
          </button>
        </form>
        <button className="button" type="button" onClick={copy}>
          Copy draft
        </button>
      </div>
      <p className="fine" role="status" aria-live="polite">
        {feedback ||
          "Download saves locally. No email, posting, or automatic sending."}
      </p>
    </div>
  );
}
