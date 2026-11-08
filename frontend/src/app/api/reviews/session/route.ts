import { handleReviewSessionPost } from "../../../../../../backend/src/review-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function POST(request:Request){return handleReviewSessionPost(request);}
