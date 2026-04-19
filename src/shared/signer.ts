import { PDFDocument } from "pdf-lib";

import { type SignatureFormat, type SignaturePosition } from "./pdf.js";

export async function signPdf(
  opts: Readonly<{
    format: SignatureFormat;
    pdfBytes: Readonly<Uint8Array>;
    position: Readonly<SignaturePosition>;
    sigBytes: Readonly<Uint8Array>;
  }>,
): Promise<Uint8Array> {
  const { pdfBytes, sigBytes, format, position } = opts;
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const sigImage =
    format === "png" ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);

  const pageCount = pdfDoc.getPageCount();
  if (pageCount === 0) {
    throw new Error("PDF has no pages");
  }
  const target = pdfDoc.getPage(pageCount - 1);

  target.drawImage(sigImage, position);

  return pdfDoc.save();
}
