export function escapeCssValue(value: string): string {
  return value.replace(/[\0-\x1f\x7f"\\'[\]()]/g, (char) => {
    const code = char.charCodeAt(0).toString(16).padStart(2, "0");
    return `\\${code} `;
  });
}
