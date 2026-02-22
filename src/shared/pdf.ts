import { PDFDocument } from "pdf-lib";

const FRENCH_MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

export function getTargetMonthAndYear(date: Date = new Date()): {
  monthIndex: number;
  year: number;
} {
  const day = date.getDate();
  let monthIndex = date.getMonth();
  let year = date.getFullYear();

  // Before the 10th, use previous month (timesheets are for prior period)
  if (day < 10) {
    monthIndex -= 1;
    if (monthIndex < 0) {
      monthIndex = 11; // December
      year -= 1;
    }
  }

  return { monthIndex, year };
}

export function generateAttachmentName(senderLastname: string, date: Date = new Date()): string {
  const { monthIndex, year } = getTargetMonthAndYear(date);
  const month = FRENCH_MONTHS[monthIndex];
  const prefix = senderLastname.trim();
  return prefix === ""
    ? `${month}${year % 100}.pdf`
    : `${prefix.toUpperCase()} - ${month}${year % 100}.pdf`;
}

export function extractLastname(fromText: string): string {
  const name = fromText
    .replace(/^From:\s*/i, "")
    .replace(/<[^>]+>\s*$/, "")
    .trim();
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "Unknown";
  }
  if (parts.length === 1) {
    return parts[0] ?? "Unknown";
  }

  // Check for leading uppercase parts (e.g., "DUPONT Jean" or "DE LA TOUR Pierre")
  const uppercaseParts: string[] = [];
  for (const part of parts) {
    if (part === part.toUpperCase() && part.length > 1) {
      uppercaseParts.push(part);
    } else {
      break;
    }
  }

  return uppercaseParts.length > 0 ? uppercaseParts.join(" ") : (parts.at(-1) ?? "Unknown");
}

export function extractEmail(fromText: string): string {
  const angleMatch = fromText.match(/<([^>]+@[^>]+)>/);
  if (angleMatch?.[1] !== undefined) {
    return angleMatch[1];
  }
  const emailMatch = fromText.match(/[\w.+-]+@[\w.-]+\.\w+/);
  return emailMatch?.[0] ?? "";
}

export interface SignaturePosition {
  height: number;
  width: number;
  x: number;
  y: number;
}

export type SignatureFormat = "png" | "jpg";

const EXTENSION_FORMAT_MAP: Record<string, SignatureFormat> = {
  ".jpeg": "jpg",
  ".jpg": "jpg",
  ".png": "png",
};

export function getSignatureFormat(filename: string): SignatureFormat {
  const lower = filename.toLowerCase();
  for (const [ext, format] of Object.entries(EXTENSION_FORMAT_MAP)) {
    if (lower.endsWith(ext)) {
      return format;
    }
  }
  throw new Error(
    `Unsupported signature format: "${filename}". Only .png, .jpg, .jpeg are supported.`,
  );
}

export async function signPdf(opts: {
  format: SignatureFormat;
  pdfBytes: Uint8Array;
  position: SignaturePosition;
  sigBytes: Uint8Array;
}): Promise<Uint8Array> {
  const { pdfBytes, sigBytes, format, position } = opts;
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const sigImage =
    format === "png" ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);

  const pages = pdfDoc.getPages();
  const target = pages.at(-1);
  if (!target) {
    throw new Error("PDF has no pages");
  }

  target.drawImage(sigImage, position);

  return pdfDoc.save();
}
