"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Script from "next/script"
import { Button } from "@/components/ui/button"

declare global {
  interface Window {
    pdfjsLib?: any
  }
}

type Props = { id: string }

export default function PreviewClient({ id }: Props) {
  const [scriptReady, setScriptReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pdfRef = useRef<any>(null)

  const canLoad = useMemo(() => !!id, [id])

  const renderPage = async (s: number) => {
    const pdf = pdfRef.current
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!pdf || !canvas || !container) return

    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const maxW = Math.max(320, container.clientWidth - 24)
    const fitScale = maxW / viewport.width
    const finalScale = Math.max(0.5, Math.min(3, fitScale * s))
    const vp = page.getViewport({ scale: finalScale })

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width = Math.floor(vp.width)
    canvas.height = Math.floor(vp.height)

    await page.render({ canvasContext: ctx, viewport: vp }).promise
  }

  const loadPdf = async () => {
    if (!canLoad) {
      setError("Missing id")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/adr-history/preview?id=${encodeURIComponent(id)}&ts=${Date.now()}`, { cache: "no-store" })
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(txt || `Preview failed (${res.status})`)
      }
      const buf = await res.arrayBuffer()

      const pdfjs = window.pdfjsLib
      if (!pdfjs?.getDocument) throw new Error("PDF renderer not available")

      // Disable worker to avoid cross-origin/worker issues on Android/tablets.
      const loadingTask = pdfjs.getDocument({ data: buf, disableWorker: true })
      const pdf = await loadingTask.promise
      pdfRef.current = pdf

      await renderPage(scale)
    } catch (e: any) {
      setError(e?.message || "Failed to load preview")
    } finally {
      setLoading(false)
    }
  }

  // Load on first ready
  useEffect(() => {
    if (!scriptReady) return
    loadPdf()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, id])

  // Re-render on resize
  useEffect(() => {
    if (!scriptReady) return
    const onResize = () => {
      if (!pdfRef.current) return
      renderPage(scale).catch(() => {})
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, scale])

  return (
    <div className="min-h-screen bg-gray-50">
      <Script
        src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          try {
            // @ts-ignore
            window.pdfjsLib = (window as any).pdfjsLib || (window as any)["pdfjs-dist/build/pdf"]
          } catch {}
          setScriptReady(true)
        }}
        onError={() => {
          setError("Failed to load PDF renderer (network?)")
          setLoading(false)
        }}
      />

      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-3">
          <div className="text-sm font-semibold">ADR Checklist Preview</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-transparent" onClick={() => setScale((v) => Math.max(0.6, Math.round((v - 0.2) * 10) / 10))}>
              –
            </Button>
            <div className="w-14 text-center text-xs text-gray-600">{Math.round(scale * 100)}%</div>
            <Button variant="outline" className="bg-transparent" onClick={() => setScale((v) => Math.min(2.5, Math.round((v + 0.2) * 10) / 10))}>
              +
            </Button>
            <Button variant="outline" className="bg-transparent" onClick={() => loadPdf()}>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-3 py-4">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">Rendering…</div>
        ) : (
          <div ref={containerRef} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <canvas ref={canvasRef} className="mx-auto block max-w-full" />
          </div>
        )}
      </div>
    </div>
  )
}
