/** Export the exact reviewed draft as a local text attachment. No persistence or sending. */
export async function POST(request: Request) {
  const form = await request.formData();
  const text = form.get("text");
  const filename = form.get("filename");
  if (
    typeof text !== "string" ||
    text.length === 0 ||
    text.length > 64000 ||
    typeof filename !== "string" ||
    !/^emission-lens-brief-[0-9]+-(live|replay|synthetic)\.txt$/.test(filename)
  ) {
    return new Response("Invalid draft export.", { status: 400 });
  }
  return new Response(text.replaceAll("\r\n", "\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
