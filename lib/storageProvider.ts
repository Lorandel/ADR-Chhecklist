// lib/storageProvider.ts
// Helper to let the admin pick which object storage to use for photo uploads.
// Stored in localStorage so you can switch instantly if one provider errors.

export type StorageProvider = "auto" | "blob" | "r2"

const KEY = "adr_storage_provider"

export function getStoredProvider(): StorageProvider {
  if (typeof window === "undefined") return "auto"
  try {
    const v = window.localStorage.getItem(KEY)
    if (v === "auto" || v === "blob" || v === "r2") return v
  } catch {
    // ignore
  }
  return "auto"
}

export function setStoredProvider(p: StorageProvider) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, p)
  } catch {
    // ignore
  }
}

export function providerLabel(p: StorageProvider): string {
  if (p === "blob") return "Vercel Blob"
  if (p === "r2") return "Cloudflare R2"
  return "Auto (try preferred, fallback)"
}
