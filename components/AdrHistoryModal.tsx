"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type HistoryItem = {
  id: string
  checklist_type: "reduced" | "full"
  checklist_hash: string
  file_path: string
  created_at: string
  expires_at: string
  email_sent: boolean
  meta?: Record<string, any> | string | null
  downloadUrl?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
}

type Role = "guest" | "admin" | null

export default function AdrHistoryModal({ open, onClose }: Props) {
  const [role, setRole] = useState<Role>(null)
  const [user, setUser] = useState("")
  const [pass, setPass] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<HistoryItem[]>([])
  const [refreshTick, setRefreshTick] = useState(0)

  const reduced = useMemo(() => items.filter((i) => i.checklist_type === "reduced"), [items])
  const full = useMemo(() => items.filter((i) => i.checklist_type === "full"), [items])

  useEffect(() => {
    if (!open) {
      setRole(null)
      setUser("")
      setPass("")
      setError(null)
      setItems([])
      return
    }
  }, [open])

  useEffect(() => {
    if (!open || !role) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/adr-history?ts=${Date.now()}`, { cache: "no-store" })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || `Failed to load history (${res.status})`)
        }
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : [])
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load history")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, role, refreshTick])

  const close = () => {
    onClose()
  }

  const doLogin = () => {
    setError(null)
    if (user.trim() === "admin" && pass.trim() === "admin") {
      setRole("admin")
      return
    }
    setError("Invalid credentials")
  }

  const seeAsGuest = () => {
    setError(null)
    setRole("guest")
  }

  const safeMeta = (meta: any): Record<string, any> => {
    if (!meta) return {}
    if (typeof meta === "object") return meta
    if (typeof meta === "string") {
      try {
        const parsed = JSON.parse(meta)
        return parsed && typeof parsed === "object" ? parsed : {}
      } catch {
        return {}
      }
    }
    return {}
  }

  const formatDDMMYYYY = (iso: string) => {
    const d = new Date(iso)
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yyyy = String(d.getFullYear())
    return `${dd}-${mm}-${yyyy}`
  }

  const itemLabel = (it: HistoryItem) => {
    const m = safeMeta(it.meta)

    const driver = String(m.driverName ?? m.driver_name ?? "").trim()
    const inspector = String(m.inspectorName ?? m.inspector_name ?? "").trim()

    let date = String(m.inspectionDate ?? m.inspection_date ?? "").trim()
    if (!date && it.created_at) date = formatDDMMYYYY(it.created_at)

    const base = driver || it.checklist_hash.slice(0, 10)
    const withInspector = inspector ? `${base} (inspector: ${inspector})` : base

    return date ? `${withInspector} • ${date}` : withInspector
  }

  const onDelete = async (it: HistoryItem) => {
    if (role !== "admin") return
    const ok = confirm("Delete this ZIP from history?")
    if (!ok) return

    try {
      setLoading(true)
      const res = await fetch("/api/adr-history/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: it.id, user: "admin", password: "admin" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `Delete failed (${res.status})`)
      }
      setRefreshTick((x) => x + 1)
    } catch (e: any) {
      setError(e?.message || "Delete failed")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close} />

      <div className="relative w-[min(92vw,820px)] max-h-[84vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="font-semibold">ADR Checklists History</div>
          <button
            type="button"
            onClick={close}
            className="rounded-full px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-auto max-h-[calc(84vh-64px)]">
          {!role ? (
            <div className="max-w-sm mx-auto">
              <div className="text-center mb-6">
                <div className="text-lg font-semibold">Login</div>
                <div className="text-sm text-gray-600">Admin can delete history items.</div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>User</Label>
                  <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Enter user" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="Enter password"
                    type="password"
                  />
                </div>

                {error && <div className="text-sm text-red-600">{error}</div>}

                <Button className="w-full" onClick={doLogin}>
                  Log in
                </Button>

                <Button variant="outline" className="w-full bg-transparent" onClick={seeAsGuest}>
                  See as guest
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Viewing as <span className="font-semibold">{role}</span>
                </div>
                <Button
                  variant="outline"
                  className="bg-transparent"
                  onClick={() => setRefreshTick((x) => x + 1)}
                >
                  Refresh
                </Button>
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}

              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="font-semibold mb-3">Reduced ADR Checklist</div>
                {loading && items.length === 0 ? (
                  <div className="text-sm text-gray-600">Loading...</div>
                ) : reduced.length === 0 ? (
                  <div className="text-sm text-gray-600">No items</div>
                ) : (
                  <div className="space-y-2">
                    {reduced.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{itemLabel(it)}</div>
                          <div className="text-xs text-gray-600 truncate">
                            {new Date(it.created_at).toLocaleString()} • expires{" "}
                            {new Date(it.expires_at).toLocaleDateString()}
                            {it.email_sent ? " • emailed" : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a href={it.downloadUrl || "#"} target="_blank" rel="noreferrer" className="inline-flex">
                            <Button variant="outline" className="bg-transparent" disabled={!it.downloadUrl}>
                              Download ZIP
                            </Button>
                          </a>
                          {role === "admin" && (
                            <Button variant="outline" className="bg-transparent" onClick={() => onDelete(it)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="font-semibold mb-3">Full ADR Checklist</div>
                {loading && items.length === 0 ? (
                  <div className="text-sm text-gray-600">Loading...</div>
                ) : full.length === 0 ? (
                  <div className="text-sm text-gray-600">No items</div>
                ) : (
                  <div className="space-y-2">
                    {full.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{itemLabel(it)}</div>
                          <div className="text-xs text-gray-600 truncate">
                            {new Date(it.created_at).toLocaleString()} • expires{" "}
                            {new Date(it.expires_at).toLocaleDateString()}
                            {it.email_sent ? " • emailed" : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a href={it.downloadUrl || "#"} target="_blank" rel="noreferrer" className="inline-flex">
                            <Button variant="outline" className="bg-transparent" disabled={!it.downloadUrl}>
                              Download ZIP
                            </Button>
                          </a>
                          {role === "admin" && (
                            <Button variant="outline" className="bg-transparent" onClick={() => onDelete(it)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
