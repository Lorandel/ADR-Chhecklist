"use client"

import * as React from "react"
import {
  ArrowLeftIcon,
  ArrowUpDownIcon,
  BoxesIcon,
  PackagePlusIcon,
  CheckIcon,
  DownloadIcon,
  FlagIcon,
  RotateCcwIcon,
  ScanLineIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"
import { InventoryFilterFields } from "@/components/inventory-filter-fields"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Stats } from "@/lib/counting"
import type { InventoryFieldFilters, Session, SortKey, StatusFilter } from "@/lib/types"
import { cn } from "@/lib/utils"

const SORT_ITEMS: { value: SortKey; label: string }[] = [
  { value: "source", label: "File order" },
  { value: "address", label: "Location A→Z" },
  { value: "article", label: "Article number" },
  { value: "quantity", label: "Highest stock" },
]

type SessionToolbarProps = {
  session: Session
  stats: Stats
  visibleCount: number
  query: string
  onQueryChange: (value: string) => void
  status: StatusFilter
  onStatusChange: (value: StatusFilter) => void
  fieldFilters: InventoryFieldFilters
  onFieldFiltersChange: (value: InventoryFieldFilters) => void
  onClearFieldFilters: () => void
  sort: SortKey
  onSortChange: (value: SortKey) => void
  onDownload: () => void
  onBack: () => void
  onFinish: () => void
  onResetProgress: () => void
  onAddExtraGoods: () => void
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "ok" | "diff" | "note"
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span
        className={cn(
          "tnum text-lg leading-none font-semibold tabular-nums",
          tone === "ok" && "text-ok",
          tone === "diff" && "text-diff",
          tone === "note" && "text-note",
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground truncate text-[10px] font-medium tracking-wider uppercase">{label}</span>
    </div>
  )
}

export function SessionToolbar({
  session,
  stats,
  visibleCount,
  query,
  onQueryChange,
  status,
  onStatusChange,
  fieldFilters,
  onFieldFiltersChange,
  onClearFieldFilters,
  sort,
  onSortChange,
  onDownload,
  onBack,
  onFinish,
  onResetProgress,
  onAddExtraGoods,
}: SessionToolbarProps) {
  const percent = stats.total ? Math.round((stats.checked / stats.total) * 100) : 0
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const activeFieldFilters = Object.values(fieldFilters).filter((value) => value.trim()).length

  const filters: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: stats.total },
    { value: "open", label: "Open", count: stats.open },
    { value: "counted", label: "Counted", count: stats.checked },
    { value: "difference", label: "Differences", count: stats.differences },
    { value: "observation", label: "Notes", count: stats.observations },
  ]

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-3 pt-3 pb-2 sm:px-6 sm:pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <BoxesIcon className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm leading-tight font-semibold">{session.fileName}</span>
              <span className="text-muted-foreground truncate font-mono text-[11px] leading-tight">
                {stats.total.toLocaleString()} units · sheet {session.sheetName}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="outline" size="icon" onClick={onBack}>
                    <ArrowLeftIcon />
                    <span className="sr-only">Back and save inventory</span>
                  </Button>
                }
              />
              <TooltipContent>Back · inventory remains saved</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="ghost" size="icon" onClick={onResetProgress} className="hidden sm:inline-flex">
                    <RotateCcwIcon />
                    <span className="sr-only">Reset count</span>
                  </Button>
                }
              />
              <TooltipContent>Reset the whole count</TooltipContent>
            </Tooltip>
            <Button variant="outline" onClick={onAddExtraGoods}>
              <PackagePlusIcon data-icon="inline-start" />
              <span className="hidden sm:inline">Extra goods</span>
              <span className="sm:hidden">Extra</span>
            </Button>
            <Button variant="outline" onClick={onDownload}>
              <DownloadIcon data-icon="inline-start" />
              <span className="hidden sm:inline">Download Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>
            <Button onClick={onFinish}>
              <FlagIcon data-icon="inline-start" />
              <span className="hidden sm:inline">Finish inventory</span>
              <span className="sm:hidden">Finish</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-1 items-end gap-5 overflow-hidden sm:gap-8">
              <Stat label="Counted" value={`${stats.checked.toLocaleString()}`} tone="ok" />
              <Stat label="Open" value={stats.open.toLocaleString()} />
              <Stat label="Differences" value={stats.differences.toLocaleString()} tone="diff" />
              <Stat
                label="Net delta"
                value={stats.netDelta > 0 ? `+${stats.netDelta.toLocaleString()}` : stats.netDelta.toLocaleString()}
                tone={stats.netDelta === 0 ? "default" : "diff"}
              />
              <div className="hidden sm:flex">
                <Stat label="Notes" value={stats.observations.toLocaleString()} tone="note" />
              </div>
            </div>
            <span className="tnum text-muted-foreground shrink-0 font-mono text-xs">{percent}%</span>
          </div>
          <Progress value={percent} className="h-1.5" />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <InputGroup className="sm:flex-1">
              <InputGroupAddon>
                <ScanLineIcon />
              </InputGroupAddon>
              <InputGroupInput
                ref={searchRef}
                autoFocus
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    onQueryChange(event.currentTarget.value.trim())
                  }
                }}
                placeholder="Scan or search any imported detail…"
                aria-label="Search inventory rows and all imported details"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
              />
              {query ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    onClick={() => {
                      onQueryChange("")
                      searchRef.current?.focus()
                    }}
                    aria-label="Clear search"
                  >
                    <XIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={filtersOpen || activeFieldFilters > 0 ? "secondary" : "outline"}
                className="flex-1 sm:flex-none"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <SlidersHorizontalIcon data-icon="inline-start" />
                Filters
                {activeFieldFilters > 0 ? (
                  <span className="bg-primary text-primary-foreground tnum rounded-full px-1.5 text-[10px]">
                    {activeFieldFilters}
                  </span>
                ) : null}
              </Button>

              <Select
                items={SORT_ITEMS}
                value={sort}
                onValueChange={(value) => onSortChange(value as SortKey)}
              >
                <SelectTrigger className="h-9 flex-1 sm:w-44 sm:flex-none">
                  <ArrowUpDownIcon className="text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SORT_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtersOpen || activeFieldFilters > 0 ? (
            <div className="bg-secondary/35 flex flex-col gap-2 rounded-lg border p-3">
              <InventoryFilterFields filters={fieldFilters} onChange={onFieldFiltersChange} />
              {activeFieldFilters > 0 ? (
                <Button variant="ghost" size="sm" className="self-end" onClick={onClearFieldFilters}>
                  <XIcon data-icon="inline-start" />
                  Clear detail filters
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
          <ToggleGroup
            value={[status]}
            onValueChange={(value) => onStatusChange(((value as StatusFilter[])[0] ?? "all") as StatusFilter)}
            variant="outline"
            size="sm"
            className="w-max"
          >
            {filters.map((filter) => (
              <ToggleGroupItem
                key={filter.value}
                value={filter.value}
                className="data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:border-primary gap-1.5"
              >
                {status === filter.value ? <CheckIcon data-icon="inline-start" /> : null}
                {filter.label}
                <span className="tnum text-[10px] opacity-70">{filter.count.toLocaleString()}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {visibleCount !== stats.total ? (
        <div className="bg-secondary/60 border-t">
          <p className="text-muted-foreground mx-auto w-full max-w-7xl px-3 py-1.5 font-mono text-[11px] sm:px-6">
            Showing {visibleCount.toLocaleString()} of {stats.total.toLocaleString()} rows
          </p>
        </div>
      ) : null}
    </header>
  )
}
