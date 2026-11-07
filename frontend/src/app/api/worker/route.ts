import { handleWorkerPost } from "@emission-lens/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = handleWorkerPost;
