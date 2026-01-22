"use client"

import { useState } from "react"
import ADRChecklist, { type ChecklistVariant } from "@/components/AdrChecklist"

export default function HomePage() {
  const [variant, setVariant] = useState<ChecklistVariant | null>(null)

  if (variant) {
    return <ADRChecklist variant={variant} onBack={() => setVariant(null)} />
  }
  return (
    <div className="min-h-[100vh] flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold text-center mb-8">ADR Checklist</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Under 1000 */}
          <button
            type="button"
            className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
            onClick={() => setVariant("under1000")}
          >
            <div className="text-xl font-semibold mb-2">Reduced Checklist (Under 1000)</div>
          </button>

          {/* Full */}
          <button
            type="button"
            className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
            onClick={() => setVariant("full")}
          >
            <div className="text-xl font-semibold mb-2">Full Checklist (1000+)</div>
      
          </button>
        </div>

        <p className="text-sm text-gray-600 text-center mt-6">
           Choose the correct option based on the ADR points planned for loading.
        </p>
      </div>
    </div>
  )
}
