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

export function getTargetMonthAndYear(date: Readonly<Date> = new Date()): {
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

export function generateAttachmentName(
  senderLastname: string,
  date: Readonly<Date> = new Date(),
): string {
  const { monthIndex, year } = getTargetMonthAndYear(date);
  const month = FRENCH_MONTHS[monthIndex];
  const prefix = senderLastname.trim();
  return prefix === ""
    ? `${month}${year % 100}.pdf`
    : `${prefix.toUpperCase()} - ${month}${year % 100}.pdf`;
}

export interface SignaturePosition {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export type SignatureFormat = "png" | "jpg";

const EXTENSION_FORMAT_MAP: Record<string, SignatureFormat> = {
  ".jpeg": "jpg",
  ".jpg": "jpg",
  ".png": "png",
};

export function getSignatureFormat(filename: string): SignatureFormat {
  const ext = /\.\w+$/.exec(filename.toLowerCase())?.[0] ?? "";
  const format = EXTENSION_FORMAT_MAP[ext];
  if (format === undefined) {
    throw new Error(
      `Unsupported signature format: "${filename}". Only .png, .jpg, .jpeg are supported.`,
    );
  }
  return format;
}

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
