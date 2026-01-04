export function escapeCssValue(value: string): string {
  // eslint-disable-next-line no-control-regex -- Intentional: escaping control chars for CSS
  return value.replaceAll(/[\0-\u001F\u007F"\\'[\]()]/g, (char) => {
    const code = (char.codePointAt(0) ?? 0).toString(16).padStart(2, "0");
    return `\\${code} `;
  });
}
