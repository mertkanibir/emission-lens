import { handleFrameGet } from "@emission-lens/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleFrameGet(request, (await params).id);
}
