export const HANDOFF_TTL_MS = 2 * 60 * 1000;
export const HANDOFF_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const DESKTOP_OTP_TYPE = "magiclink";

export function randomString(length: number, alphabet: string): string {
  if (!Number.isInteger(length) || length < 1 || alphabet.length < 2 || alphabet.length > 256) {
    throw new RangeError("Invalid random string parameters.");
  }

  const limit = Math.floor(256 / alphabet.length) * alphabet.length;
  let result = "";
  while (result.length < length) {
    const bytes = new Uint8Array(Math.ceil((length - result.length) * 1.5));
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= limit) continue;
      result += alphabet[byte % alphabet.length];
      if (result.length === length) break;
    }
  }
  return result;
}

export function isValidState(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function isValidChallenge(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function isValidVerifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}

export function isValidHandoffCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9]{32}$/.test(value);
}

export function base64UrlFromDigest(digest: ArrayBuffer): string {
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createS256Challenge(verifier: string): Promise<string> {
  return crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(verifier))
    .then(base64UrlFromDigest);
}
