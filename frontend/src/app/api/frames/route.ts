import { handleFramePost } from "@emission-lens/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleFramePost(request);
}
