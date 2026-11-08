import PDFDocument from "pdfkit";
import { createHash } from "node:crypto";

const INK = "#203D32", MUTED = "#59665C", GREEN = "#34794D", CREAM = "#F7F1E6", RULE = "#D6DECE";
const LEFT = 48, WIDTH = 516;

/** Keep the original UTF-8 draft attached; use standard-font-safe display typography. */
export function pdfDisplayText(text: string): string {
  return text.replaceAll("₂", "2").replaceAll("ₓ", "x").replaceAll("≥", ">=").replaceAll("≤", "<=")
    .replaceAll("→", "->").replaceAll("×", "x").replaceAll("−", "-")
    .replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/gu, "?");
}

/** A read-only export of the exact displayed draft, with no fresh queries or numeric inference. */
export async function buildBriefPdf(text: string, filename: string, exportedAt = new Date()): Promise<Buffer> {
  const normalized = text.replaceAll("\r\n", "\n");
  const digest = createHash("sha256").update(normalized, "utf8").digest("hex");
  const doc = new PDFDocument({
    size: "LETTER", bufferPages: true, margins: { top: 96, left: LEFT, right: LEFT, bottom: 62 },
    info: { Title: "Emission Lens - Scoped investigation brief", Author: "Mert and Carter", Subject: "Reviewable estimated emissions and evidence", Keywords: `draft, source-sha256:${digest}`, Creator: "Emission Lens", Producer: "Emission Lens", CreationDate: exportedAt },
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  function header() {
    doc.save().rect(0, 0, 612, 792).fill(CREAM).restore();
    doc.x = LEFT; doc.y = 96;
  }
  header();
  doc.on("pageAdded", header);
  function ensure(height: number) { if (doc.y + height > 720) doc.addPage(); }
  function heading(label: string) {
    ensure(45);
    doc.moveDown(.5).font("Helvetica-Bold").fontSize(10).fillColor(GREEN).text(label.toUpperCase(), LEFT, doc.y, { width: WIDTH, characterSpacing: .8 });
    doc.moveDown(.55);
  }
  function paragraph(value: string, emphasis = false) {
    const display = pdfDisplayText(value);
    doc.font(emphasis ? "Helvetica-Bold" : "Helvetica").fontSize(emphasis ? 10.2 : 9.4).fillColor(INK);
    const height = doc.heightOfString(display, { width: WIDTH, lineGap: 3 });
    ensure(Math.min(height + 10, 624));
    if (emphasis && height < 130) {
      const y = doc.y;
      doc.save().roundedRect(LEFT - 9, y - 6, WIDTH + 18, height + 13, 3).fill("#E8EEDC").restore();
      doc.fillColor(INK).text(display, LEFT, y, { width: WIDTH, lineGap: 3 });
      doc.y = y + height + 14;
    } else {
      doc.text(display, LEFT, doc.y, { width: WIDTH, lineGap: 3 });
      doc.moveDown(.6);
    }
  }
  doc.font("Helvetica-Bold").fontSize(27).fillColor(INK).text("Scoped investigation brief", LEFT, 99, { width: WIDTH });
  doc.moveDown(.5).font("Helvetica").fontSize(9.2).fillColor(MUTED).text("A dated decision-support draft from selected camera evidence.", { width: WIDTH });
  doc.moveDown(.8);
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const scope = lines.filter((line) => /^(Camera:|Mode:|Window:|Status:)/.test(line));
  heading("Requested scope");
  for (const line of scope) paragraph(line);
  paragraph(`Exported: ${exportedAt.toISOString()} (UTC). Draft status: review required.`);
  paragraph("Numbers retain the selected observation and model scope. Missing evidence remains unavailable; hypothetical changes are not demonstrated savings.");
  heading("Observations and comparison");
  let section = "observations";
  for (const line of lines) {
    if (line === "Investigation brief" || /^(Camera:|Mode:|Window:|Status:)/.test(line)) continue;
    if (line.startsWith("Factor provenance:") && section !== "sources") { heading("Model inputs and provenance"); section = "sources"; }
    if (line.startsWith("External context:") && section !== "context") { heading("Regional context"); section = "context"; }
    if (line.startsWith("Review annotations") && section !== "reviews") { heading("Evidence review"); section = "reviews"; }
    paragraph(line, /^Estimated (CO2|CO₂|NOx|NOₓ):/.test(line));
  }
  heading("Export integrity");
  paragraph("The exact reviewed UTF-8 draft is embedded as an attached text file. Display typography normalizes special symbols for standard-font compatibility; the attachment preserves the original characters and full evidence references.");
  doc.font("Courier").fontSize(8).fillColor(MUTED).text(`SHA-256 ${digest}`, { width: WIDTH, lineGap: 2 });
  doc.file(Buffer.from(normalized, "utf8"), { name: filename.replace(/\.pdf$/, ".txt"), type: "text/plain", description: "Exact reviewed investigation draft (UTF-8)", creationDate: exportedAt, modifiedDate: exportedAt });
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.font("Helvetica-Bold").fontSize(18).fillColor(INK).text("Emission Lens", LEFT, 31, { lineBreak: false });
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text("TRAFFIC OBSERVATION / ESTIMATED EMISSIONS", LEFT, 55, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(8).fillColor(GREEN).text("DRAFT FOR REVIEW", 408, 39, { width: 156, align: "right", lineBreak: false });
    doc.moveTo(LEFT, 75).lineTo(564, 75).lineWidth(.6).strokeColor(RULE).stroke();
    doc.moveTo(LEFT, 742).lineTo(564, 742).lineWidth(.6).strokeColor(RULE).stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text("Mert and Carter / Estimated tailpipe emissions / Review before sharing", LEFT, 754, { width: 430, lineBreak: false });
    doc.font("Helvetica-Bold").text(`${i + 1} / ${pages.count}`, 490, 754, { width: 74, align: "right", lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return result;
}
