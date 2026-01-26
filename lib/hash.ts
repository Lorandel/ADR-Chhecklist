// lib/hash.ts
// SHA-256 hashing helpers for the browser.

export async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("WebCrypto (crypto.subtle) is not available in this environment")
  }

  const enc = new TextEncoder()
  const data = enc.encode(input)
  const digest = await crypto.subtle.digest("SHA-256", data)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
