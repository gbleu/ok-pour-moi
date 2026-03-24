export function extractLastname(fromText: string): string {
  const name = fromText
    .replace(/^From:\s*/i, "")
    .replace(/<[^>]+>\s*$/, "")
    .trim();
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "";
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
  const angleMatch = /<([^>]+@[^>]+)>/.exec(fromText);
  if (angleMatch?.[1] !== undefined) {
    return angleMatch[1];
  }
  const emailMatch = /[\w.+-]+@[\w.-]+\.\w+/.exec(fromText);
  return emailMatch?.[0] ?? "";
}
