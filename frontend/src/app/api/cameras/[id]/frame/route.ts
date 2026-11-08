import { handleFrameGet } from "@emission-lens/backend";
import { readProducerPreview } from "@/lib/preview-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  return (await readProducerPreview(request, id)) ?? handleFrameGet(request, id);
}
