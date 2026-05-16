// AES-256-GCM client-side encryption using the Web Crypto API.
// The server and desktop app never see plaintext — they relay/store opaque bytes.
//
// Encrypted file format: [PC2E magic 4B][IV 12B][AES-GCM ciphertext + 16B tag]
// Files without the magic header are treated as legacy plaintext (backward compat).

const MAGIC = new Uint8Array([0x50, 0x43, 0x32, 0x45]); // "PC2E"
const SESSION_KEY = "pc2cloud_ek";

let _key: CryptoKey | null = null;

export async function deriveEncryptionKey(password: string, email: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(email.toLowerCase() + "pc2cloud-v1"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // extractable so we can persist to sessionStorage
    ["encrypt", "decrypt"],
  );
}

export async function encryptFile(key: CryptoKey, plaintext: ArrayBuffer): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const buf = new ArrayBuffer(MAGIC.length + iv.length + ciphertext.byteLength);
  const out = new Uint8Array(buf);
  out.set(MAGIC, 0);
  out.set(iv, MAGIC.length);
  out.set(new Uint8Array(ciphertext), MAGIC.length + iv.length);
  return out;
}

export async function decryptFile(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(data);
  const hasMagic = bytes.length > MAGIC.length + 12 && MAGIC.every((b, i) => bytes[i] === b);
  if (!hasMagic) return data; // legacy plaintext — return unchanged

  const iv = bytes.slice(MAGIC.length, MAGIC.length + 12);
  const ciphertext = bytes.slice(MAGIC.length + 12);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}

export async function setSessionKey(key: CryptoKey): Promise<void> {
  _key = key;
  try {
    const raw = await crypto.subtle.exportKey("raw", key);
    const b64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
    sessionStorage.setItem(SESSION_KEY, b64);
  } catch { /* non-fatal: key still available in memory */ }
}

export async function loadSessionKey(): Promise<CryptoKey | null> {
  if (_key) return _key;
  try {
    const b64 = sessionStorage.getItem(SESSION_KEY);
    if (!b64) return null;
    const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    _key = await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    return _key;
  } catch {
    return null;
  }
}

export function getSessionKey(): CryptoKey | null {
  return _key;
}

export function clearSessionKey(): void {
  _key = null;
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
