import { handleMeasurementGet, handleMeasurementPost } from "@emission-lens/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Backend owns authentication, validation, registry lookup and atomic publication. */
export async function POST(request: Request) {
  return handleMeasurementPost(request);
}

/** Public summary only; no route context is forwarded as the optional backend clock. */
export async function GET(request: Request) {
  return handleMeasurementGet(request);
}
