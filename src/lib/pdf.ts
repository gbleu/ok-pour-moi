import { PDFDocument } from "pdf-lib";

const FRENCH_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

export function generateAttachmentName(senderLastname: string): string {
  const now = new Date();
  const month = FRENCH_MONTHS[now.getMonth()];
  const year = now.getFullYear() % 100;
  return `${senderLastname.toUpperCase()} - ${month}${year}.pdf`;
}

export function extractLastname(fromText: string): string {
  const name = fromText
    .replace(/^From:\s*/i, "")
    .replace(/<[^>]+>$/, "")
    .trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Unknown";
  if (parts.length === 1) return parts[0]!;
  const uppercaseParts: string[] = [];
  for (const part of parts) {
    if (part === part.toUpperCase() && part.length > 1) {
      uppercaseParts.push(part);
    } else {
      break;
    }
  }
  if (uppercaseParts.length > 0) return uppercaseParts.join(" ");
  return parts[parts.length - 1]!;
}

export type SignaturePosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function signPdf(
  pdfBytes: Uint8Array,
  sigBytes: Uint8Array,
  sigPath: string,
  position: SignaturePosition,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const sigImage = sigPath.endsWith(".png")
    ? await pdfDoc.embedPng(sigBytes)
    : await pdfDoc.embedJpg(sigBytes);

  const pages = pdfDoc.getPages();
  const target = pages[pages.length - 1];
  if (!target) throw new Error("PDF has no pages");

  target.drawImage(sigImage, position);

  return pdfDoc.save();
}
