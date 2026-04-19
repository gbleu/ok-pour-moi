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
