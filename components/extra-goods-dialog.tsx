"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type ExtraGoodsInput = {
  articleNumber: string
  articleName: string
  batch: string
  barcode: string
  quantity: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (value: ExtraGoodsInput) => void
}

const EMPTY_FORM = {
  articleNumber: "",
  articleName: "",
  batch: "",
  barcode: "",
  quantity: "",
}

export function ExtraGoodsDialog({ open, onOpenChange, onAdd }: Props) {
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM)
      setError("")
    }
  }, [open])

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (error) setError("")
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const quantity = Number(form.quantity.replace(",", "."))
    if (!form.articleNumber.trim()) {
      setError("Article number is required.")
      return
    }
    if (!form.articleName.trim()) {
      setError("Article name is required.")
      return
    }
    if (!form.barcode.trim()) {
      setError("Barcode is required.")
      return
    }
    if (!form.quantity.trim() || !Number.isFinite(quantity) || quantity < 0) {
      setError("Enter a valid quantity.")
      return
    }

    onAdd({
      articleNumber: form.articleNumber.trim(),
      articleName: form.articleName.trim(),
      batch: form.batch.trim(),
      barcode: form.barcode.trim(),
      quantity,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Add extra goods</DialogTitle>
            <DialogDescription>
              Record goods found physically that are not present in the imported inventory.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="extra-article-number">Article number</Label>
              <Input
                id="extra-article-number"
                value={form.articleNumber}
                onChange={(event) => update("articleNumber", event.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="extra-article-name">Article name</Label>
              <Input
                id="extra-article-name"
                value={form.articleName}
                onChange={(event) => update("articleName", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="extra-batch">Batch</Label>
              <Input id="extra-batch" value={form.batch} onChange={(event) => update("batch", event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="extra-barcode">Barcode</Label>
              <Input
                id="extra-barcode"
                value={form.barcode}
                onChange={(event) => update("barcode", event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="extra-quantity">Quantity</Label>
              <Input
                id="extra-quantity"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.quantity}
                onChange={(event) => update("quantity", event.target.value)}
              />
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add extra goods</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
