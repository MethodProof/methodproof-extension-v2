/** E2E encryption — AES-256-GCM with company-held keys (Web Crypto API) */

const NONCE_BYTES = 12;
const SENSITIVE_FIELDS = new Set(["prompt_text", "response_text", "command", "output_snippet", "diff", "query", "text_snippet", "content_snippet"]);

export function isE2EEncrypted(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("e2e:v1:");
}

async function importKey(hexKey: string): Promise<CryptoKey> {
  const raw = new Uint8Array(hexKey.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function computeFingerprint(hexKey: string): Promise<string> {
  const raw = new Uint8Array(hexKey.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return Array.from(new Uint8Array(hash).slice(0, 4))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function encryptField(plaintext: string, hexKey: string, fp: string): Promise<string> {
  const key = await importKey(hexKey);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, encoded));
  const combined = new Uint8Array(NONCE_BYTES + ciphertext.length);
  combined.set(nonce);
  combined.set(ciphertext, NONCE_BYTES);
  return `e2e:v1:${fp}:${btoa(String.fromCharCode(...combined))}`;
}

export async function encryptEventData(
  data: Record<string, unknown>,
  hexKey: string,
  fp: string,
): Promise<Record<string, unknown>> {
  const result = { ...data };
  for (const field of SENSITIVE_FIELDS) {
    if (field in result && typeof result[field] === "string") {
      result[field] = await encryptField(result[field] as string, hexKey, fp);
    }
  }
  return result;
}
