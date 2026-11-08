import { openBriefReport } from "@/lib/brief-report";
import { buildBriefPdf } from "@/lib/brief-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Export only the reviewed form payload; never re-query a changing live window. */
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 1024 * 1024) return new Response("Draft export too large.", { status: 413 });
  let form: FormData;
  try { form = await request.formData(); } catch { return new Response("Invalid draft export.", { status: 400 }); }
  const text = form.get("text"), filename = form.get("filename");
  if (typeof text !== "string" || text.length === 0 || text.length > 64000 || typeof filename !== "string" || filename.length > 100 || !/^emission-lens-brief-[0-9]+-(live|replay|synthetic)\.pdf$/.test(filename)) {
    return new Response("Invalid draft export.", { status: 400 });
  }
  const report=form.get("report"),signature=form.get("signature");
  let snapshot;
  if(report!==null||signature!==null){try{if(typeof report!=="string"||typeof signature!=="string")throw new Error();snapshot=openBriefReport(report,signature,text,filename);}catch{return new Response("The report snapshot does not match this reviewed draft. Rebuild the brief.",{status:400});}}
  const pdf = await buildBriefPdf(text, filename,new Date(),snapshot);
  return new Response(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}
