export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  return Uint8Array.from(binaryString, (char) => char.codePointAt(0) ?? 0);
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x80_00;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCodePoint(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
