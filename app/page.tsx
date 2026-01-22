"use client"

import { useMemo, useState } from "react"
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import ADRChecklist, { type ChecklistVariant } from "@/components/AdrChecklist"

export default function HomePage() {
  const [pointsInput, setPointsInput] = useState("")
  const [variant, setVariant] = useState<ChecklistVariant | null>(null)

  const points = useMemo(() => {
    const n = Number.parseInt(pointsInput.replace(/[^0-9]/g, ""), 10)
    return Number.isFinite(n) ? n : NaN
  }, [pointsInput])

  if (variant) {
    return <ADRChecklist variant={variant} onBack={() => setVariant(null)} />
  }

  const canContinue = Number.isFinite(points)

  return (
    <div className="min-h-[100vh] flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-center mb-6">ADR Checklist</h1>

        <div className="space-y-3">
          <Label htmlFor="adrPoints" className="text-base font-semibold">
            Câte puncte ADR urmează să fie încărcate în camion?
          </Label>
          <Input
            id="adrPoints"
            value={pointsInput}
            onChange={(e) => setPointsInput(e.target.value)}
            placeholder="Introdu puncte ADR (ex: 900)"
            inputMode="numeric"
            pattern="[0-9]*"
            className="text-center text-lg"
          />
          <Button
            className="w-full"
            disabled={!canContinue}
            onClick={() => {
              const n = points
              if (!Number.isFinite(n)) return
              setVariant(n >= 1000 ? "full" : "under1000")
            }}
          >
            Continuă
          </Button>

          <p className="text-sm text-gray-600 text-center">
            Dacă sunt <strong>mai mult de 1000</strong> puncte, se deschide ADR Checklist-ul complet. Dacă sunt{" "}
            <strong>1000 sau mai puțin</strong>, se deschide varianta redusă.
          </p>
        </div>
      </div>
    </div>
  )
}
