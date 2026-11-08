import { handleMeasurementRefreshPost } from "@emission-lens/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Refresh derives from the server registry; callers cannot upload approvals here. */
export async function POST(request: Request) {
  return handleMeasurementRefreshPost(request);
}
