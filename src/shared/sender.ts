export function extractLastname(fromText: string): string {
  const name = fromText
    .replace(/^From:\s*/iu, "")
    .replace(/<[^>]+>\s*$/u, "")
    .trim();
  const parts = name.split(/\s+/u).filter(Boolean);

  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- parts.length === 1 guarantees parts[0] exists
    return parts[0]!;
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

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- parts.length >= 2 guarantees parts.at(-1) exists
  return uppercaseParts.length > 0 ? uppercaseParts.join(" ") : parts.at(-1)!;
}

export function extractEmail(fromText: string): string {
  const angleMatch = /<(?<email>[^>]+@[^>]+)>/u.exec(fromText);
  if (angleMatch?.groups?.email !== undefined) {
    return angleMatch.groups.email;
  }
  const emailMatch = /[\w.+-]+@[\w.-]+\.\w+/u.exec(fromText);
  return emailMatch?.[0] ?? "";
}
