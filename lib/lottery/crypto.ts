// Universal crypto helpers that work in both Node.js and Edge runtimes.
// Avoids top-level import of 'crypto' which can break on Edge.

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  // Prefer Web Crypto (Edge + modern Node)
  const g: any = globalThis as any;
  if (g.crypto?.subtle) {
    const data = new TextEncoder().encode(input);
    const hash = await g.crypto.subtle.digest("SHA-256", data);
    return bytesToHex(new Uint8Array(hash));
  }

  // Fallback to Node.js crypto via dynamic import
  const nodeCrypto = await import("crypto");
  return nodeCrypto.createHash("sha256").update(input).digest("hex");
}

export async function randomSeedHex(byteLen = 32): Promise<string> {
  const g: any = globalThis as any;
  if (g.crypto?.getRandomValues) {
    const arr = new Uint8Array(byteLen);
    g.crypto.getRandomValues(arr);
    return bytesToHex(arr);
  }

  const nodeCrypto = await import("crypto");
  return nodeCrypto.randomBytes(byteLen).toString("hex");
}
