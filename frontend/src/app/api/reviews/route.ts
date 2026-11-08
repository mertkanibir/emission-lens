import { handleReviewGet, handleReviewPost } from "../../../../../backend/src/review-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function GET(request:Request){return handleReviewGet(request);}
export function POST(request:Request){return handleReviewPost(request);}
