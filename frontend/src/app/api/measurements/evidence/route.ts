import { handleMeasurementEvidenceGet } from "@emission-lens/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Private provenance stays behind the backend's bearer authentication. */
export async function GET(request: Request) {
  return handleMeasurementEvidenceGet(request);
}
