import { draft_brief, listCameras } from "@emission-lens/backend";
import Link from "next/link";
import { modeLabel, parseMode, parseReduction } from "@/lib/format";

export default async function BriefPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; camera?: string; reduce?: string }>;
}) {
  const query = await searchParams;
  const mode = parseMode(query.mode);
  const cameras = listCameras();
  const cameraId = cameras.some((camera) => camera.id === query.camera) ? (query.camera as string) : "222";
  const reduction = parseReduction(query.reduce);
  const brief = Number.isFinite(reduction)
    ? draft_brief({ cameraId, mode, stoppedTimeReductionPct: reduction })
    : null;

  return (
    <main className="stack">
      <h2>Investigation brief</h2>
      <p>The draft is assembled from stored records. It is not sent anywhere.</p>
      <form action="/brief" method="get" className="panel">
        <label>
          Camera
          <select name="camera" defaultValue={cameraId}>
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.id} · {camera.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mode
          <select name="mode" defaultValue={mode}>
            <option value="live">Live</option>
            <option value="replay">Replay</option>
            <option value="synthetic">Synthetic sample</option>
          </select>
        </label>
        <label>
          Stopped-time reduction percent
          <input name="reduce" type="number" min="0" max="100" defaultValue={Number.isFinite(reduction) ? reduction : 20} />
        </label>
        <button type="submit">Draft brief</button>
      </form>
      {brief === null ? (
        <p>Enter a percentage from 0 to 100.</p>
      ) : (
        <article className="panel">
          <p className="fine">
            {modeLabel(brief.mode)} · review status {brief.review_status} · model unavailable
          </p>
          <p className="brief">{brief.text}</p>
          <p className="fine">Evidence: {brief.evidence_references.join(", ")}</p>
        </article>
      )}
      <Link href={mode === "live" ? "/" : `/?mode=${mode}`}>Back to the overview</Link>
    </main>
  );
}
