// lib/stableStringify.ts
// Deterministic JSON stringify (stable key order) for hashing.

export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>()

  const helper = (v: any): any => {
    if (v === null || typeof v !== "object") return v
    if (v instanceof Date) return v.toISOString()
    if (Array.isArray(v)) return v.map(helper)

    if (seen.has(v)) {
      // Avoid circular refs in case something unexpected slips in.
      return "[Circular]"
    }
    seen.add(v)

    const out: Record<string, any> = {}
    for (const key of Object.keys(v).sort()) {
      out[key] = helper(v[key])
    }
    return out
  }

  return JSON.stringify(helper(value))
}
