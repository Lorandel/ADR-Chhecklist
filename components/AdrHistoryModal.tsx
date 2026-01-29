"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

  const [search, setSearch] = useState("")
  // Preview (render PDF inside the app, not relying on the device PDF viewer)
  const [previewItem, setPreviewItem] = useState<HistoryItem | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)

  // Platform detection (client-only component)
  const ua = useMemo(() => (typeof navigator === "undefined" ? "" : navigator.userAgent || ""), [])
  const isIOS = useMemo(() => /iPad|iPhone|iPod/i.test(ua), [ua])
  const isAndroid = useMemo(() => /Android/i.test(ua), [ua])
  const isMobile = useMemo(() => /Mobi|Android|iPhone|iPad|iPod/i.test(ua), [ua])
  const isDesktop = useMemo(() => !!ua && !isMobile, [ua, isMobile])

  const reduced = useMemo(() => items.filter((i) => i.checklist_type === "reduced").filter((i) => matchesSearch(i, search)), [items, search])
  const full = useMemo(() => items.filter((i) => i.checklist_type === "full").filter((i) => matchesSearch(i, search)), [items, search])

  useEffect(() => {
    if (!open) {
      setRole(null)
      setUser("")
      setPass("")
      setError(null)
      setItems([])

      // close preview if modal closes
      setPreviewOpen(false)
      setPreviewItem(null)
      setPreviewError(null)
      setPreviewLoading(false)
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl)
      setPreviewBlobUrl(null)
      setZoom(1)
      return
    }
  }, [open, previewBlobUrl])

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

  const close = () => onClose()

  const doLogin = () => {
    setError(null)
    if (user.trim() === "admin" && pass.trim() === "admin12!") {
      setRole("admin")
      return
    }
    setError("Invalid credentials")
  }

  const seeAsGuest = () => {
    setError(null)
    setRole("guest")
  }

  // NOTE: Use function declarations (hoisted) to avoid "Cannot access X before initialization"
  // errors caused by helpers referenced inside useMemo/useCallback before their const initialization.
  function safeMeta(meta: any): Record<string, any> {
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

  function matchesSearch(it: HistoryItem, qRaw: string): boolean {
    const q = (qRaw || "").trim().toLowerCase()
    if (!q) return true
    const m = safeMeta(it.meta)
    const driver = String(m.driverName ?? m.driver_name ?? "").toLowerCase()
    const truck = String(m.truckPlate ?? m.truck_plate ?? m.truckNumber ?? "").toLowerCase()
    const trailer = String(m.trailerPlate ?? m.trailer_plate ?? m.trailerNumber ?? "").toLowerCase()
    const inspector = String(m.inspectorName ?? m.inspector_name ?? "").toLowerCase()
    const hash = String(it.checklist_hash ?? "").toLowerCase()
    return driver.includes(q) || truck.includes(q) || trailer.includes(q) || inspector.includes(q) || hash.includes(q)
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

  const onDownloadZip = useCallback((it: HistoryItem) => {
    if (!it.downloadUrl) return
    window.open(it.downloadUrl, "_blank", "noopener,noreferrer")
  }, [])

  const revokePreviewUrl = useCallback(() => {
    if (previewBlobUrl) {
      try {
        URL.revokeObjectURL(previewBlobUrl)
      } catch {}
    }
    setPreviewBlobUrl(null)
  }, [previewBlobUrl])

  const openPreview = useCallback(
    async (it: HistoryItem) => {
      // Android + Desktop: open PDF in a new tab using the browser's native PDF handling.
      // iOS: keep in-app preview (with pinch zoom).
      if (isAndroid || isDesktop) {
        window.open(`/api/adr-history/preview?id=${encodeURIComponent(it.id)}&ts=${Date.now()}`, "_blank", "noopener,noreferrer")
        return
      }

      setPreviewItem(it)
      setPreviewOpen(true)
      setPreviewError(null)
      setPreviewLoading(true)
      setZoom(1)
      revokePreviewUrl()

      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 20000)

      try {
        const res = await fetch(`/api/adr-history/preview?id=${encodeURIComponent(it.id)}&ts=${Date.now()}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!res.ok) {
          const txt = await res.text().catch(() => "")
          throw new Error(txt || `Preview failed (${res.status})`)
        }
        const buf = await res.arrayBuffer()
        const blob = new Blob([buf], { type: "application/pdf" })
        const url = URL.createObjectURL(blob)
        setPreviewBlobUrl(url)
      } catch (e: any) {
        setPreviewError(e?.name === "AbortError" ? "Preview timed out" : e?.message || "Preview failed")
      } finally {
        clearTimeout(t)
        setPreviewLoading(false)
      }
    },
    [revokePreviewUrl, isIOS]
  )

  const closePreview = useCallback(() => {
    setPreviewOpen(false)
    setPreviewItem(null)
    setPreviewError(null)
    setPreviewLoading(false)
    setZoom(1)
    revokePreviewUrl()
  }, [revokePreviewUrl])

  // iOS pinch-to-zoom support for the embedded preview
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
  const touchDist = (t1: Touch, t2: Touch) => {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.hypot(dx, dy)
  }

  const onPreviewTouchStart = (e: React.TouchEvent) => {
    if (!isIOS) return
    if (e.touches.length === 2) {
      const d = touchDist(e.touches[0], e.touches[1])
      pinchRef.current = { dist: d, zoom }
    }
  }

  const onPreviewTouchMove = (e: React.TouchEvent) => {
    if (!isIOS) return
    if (e.touches.length === 2 && pinchRef.current) {
      // Prevent page zoom/scroll while pinching
      e.preventDefault()
      const d = touchDist(e.touches[0], e.touches[1])
      const scale = d / pinchRef.current.dist
      const next = clamp(pinchRef.current.zoom * scale, 0.5, 3)
      setZoom(+next.toFixed(2))
    }
  }

  const onPreviewTouchEnd = (e: React.TouchEvent) => {
    if (!isIOS) return
    if (e.touches.length < 2) {
      pinchRef.current = null
    }
  }

  if (!open) return null

  const Row = ({ it }: { it: HistoryItem }) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-gray-100 p-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium break-words sm:truncate">{itemLabel(it)}</div>
        <div className="text-xs text-gray-600 break-words sm:truncate">
          {new Date(it.created_at).toLocaleString()} • expires {new Date(it.expires_at).toLocaleDateString()}
          {it.email_sent ? " • emailed" : ""}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
        <Button variant="outline" className="bg-transparent w-full sm:w-auto" onClick={() => openPreview(it)}>
          Preview
        </Button>

        <Button
          variant="outline"
          className="bg-transparent w-full sm:w-auto"
          onClick={() => onDownloadZip(it)}
          disabled={!it.downloadUrl}
        >
          Download ZIP
        </Button>

        {role === "admin" && (
          <Button variant="outline" className="bg-transparent w-full sm:w-auto" onClick={() => onDelete(it)}>
            Delete
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close} />

      <div className="relative w-[min(96vw,900px)] max-h-[84vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-gray-200">
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

        <div className="p-4 sm:p-6 overflow-auto max-h-[calc(84vh-64px)]">
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

              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <Label>Search</Label>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by driver, truck or trailer"
                  />
                </div>
                <Button
                  variant="outline"
                  className="bg-transparent"
                  onClick={() => setSearch("")}
                  disabled={!search.trim()}
                >
                  Clear
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
                      <Row key={it.id} it={it} />
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
                      <Row key={it.id} it={it} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closePreview} />

          <div className="relative w-[min(98vw,980px)] h-[min(92vh,860px)] rounded-3xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200">
              <div className="min-w-0">
                <div className="font-semibold truncate">Preview</div>
                <div className="text-xs text-gray-600 truncate">{previewItem ? itemLabel(previewItem) : ""}</div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="bg-transparent"
                  onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}
                >
                  −
                </Button>
                <div className="text-sm text-gray-600 w-14 text-center">{Math.round(zoom * 100)}%</div>
                <Button
                  variant="outline"
                  className="bg-transparent"
                  onClick={() => setZoom((z) => Math.min(2.2, Math.round((z + 0.1) * 10) / 10))}
                >
                  +
                </Button>

                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-full px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
                  aria-label="Close preview"
                >
                  ✕
                </button>
              </div>
            </div>

	            <div
	              className="p-3 sm:p-4 h-[calc(100%-56px)] overflow-auto bg-gray-50"
	              onTouchStart={handlePreviewTouchStart}
	              onTouchMove={handlePreviewTouchMove}
	              onTouchEnd={handlePreviewTouchEnd}
	              onTouchCancel={handlePreviewTouchEnd}
	            >
	              {previewLoading ? (
	                <div className="text-sm text-gray-600">Loading preview...</div>
	              ) : previewError ? (
	                <div className="space-y-2">
	                  <div className="text-sm text-red-600">{previewError}</div>
	                  {previewBlobUrl ? (
	                    <a
	                      className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
	                      href={previewBlobUrl}
	                      target="_blank"
	                      rel="noreferrer"
	                    >
	                      Open full screen
	                    </a>
	                  ) : null}
	                </div>
	              ) : previewBlobUrl ? (
	                <div className="w-full flex justify-center">
	                  <div
	                    className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden"
	                    style={{ transform: `scale(${zoom})`, transformOrigin: "top center", touchAction: "none" }}
	                  >
	                    <iframe
	                      ref={iframeRef}
	                      title="ADR Preview"
	                      src={previewBlobUrl}
	                      className="w-[900px] max-w-[96vw]"
	                      style={{ height: "calc(92vh - 160px)", border: 0 }}
	                    />
	                  </div>
	                </div>
	              ) : (
	                <div className="text-sm text-gray-600">No preview available.</div>
	              )}
	            </div>
          </div>
        </div>
      )}
    </div>
  )
}
