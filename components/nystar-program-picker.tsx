"use client"

import { useState } from "react"
import { Search } from "lucide-react"

import ExplorerListbox from "@/components/explorer-listbox"
import { Input } from "@/components/ui/input"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  NystarProgramGroup,
  NystarProgramOption,
} from "@/lib/nystar-locations"

type ProgramGrouping = "alpha" | "type" | "region"
export const SHOW_ALL_CONNECTIONS = "__show-all-connections__"

function comparePrograms(
  left: NystarProgramOption,
  right: NystarProgramOption
) {
  return (
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
    left.id.localeCompare(right.id)
  )
}

export default function NystarProgramPicker({
  categories,
  regions,
  labelledBy,
  value,
  onValueChange,
  includeAllConnections = false,
}: {
  categories: NystarProgramGroup[]
  regions: NystarProgramGroup[]
  labelledBy: string
  value: string
  onValueChange: (value: string) => void
  includeAllConnections?: boolean
}) {
  const [grouping, setGrouping] = useState<ProgramGrouping>("alpha")
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matches = (program: NystarProgramOption) =>
    !normalizedQuery ||
    program.name.toLocaleLowerCase().includes(normalizedQuery)
  const programs = categories
    .flatMap((group) => group.programs)
    .sort(comparePrograms)
  const matchingCount = programs.filter(matches).length
  const options =
    grouping === "alpha"
      ? programs
          .filter(matches)
          .map((program) => ({ value: program.id, label: program.name }))
      : (grouping === "type" ? categories : regions).flatMap((group) =>
          [...group.programs]
            .filter(matches)
            .sort(comparePrograms)
            .map((program) => ({
              value: program.id,
              label: program.name,
              group: `- ${group.name}`,
            }))
        )

  function toggleSearch(open: boolean) {
    setSearchOpen(open)
    setQuery("")
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {searchOpen ? (
            <Input
              type="search"
              autoFocus
              aria-label="Search NYSTAR programs"
              placeholder="Search programs"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") toggleSearch(false)
              }}
              className="h-7 min-w-0 flex-1 animate-in duration-200 fade-in slide-in-from-right-4"
            />
          ) : (
            <ToggleGroup
              aria-label="Group programs by"
              value={[grouping]}
              onValueChange={(value) => {
                const nextGrouping = value[0]
                if (
                  nextGrouping === "alpha" ||
                  nextGrouping === "type" ||
                  nextGrouping === "region"
                ) {
                  setGrouping(nextGrouping)
                }
              }}
              variant="outline"
              size="sm"
              spacing={0}
            >
              <ToggleGroupItem className="drawer-review-control" value="alpha">
                A to Z
              </ToggleGroupItem>
              <ToggleGroupItem className="drawer-review-control" value="type">
                Program Type
              </ToggleGroupItem>
              <Tooltip>
                <ToggleGroupItem
                  className="drawer-review-control"
                  value="region"
                  render={<TooltipTrigger />}
                >
                  ESD Region
                </ToggleGroupItem>
                <TooltipContent>
                  Empire State Development regions
                </TooltipContent>
              </Tooltip>
            </ToggleGroup>
          )}
          <Toggle
            variant="outline"
            size="sm"
            data-variant="outline"
            className="drawer-review-control"
            aria-label={searchOpen ? "Hide program search" : "Search programs"}
            pressed={searchOpen}
            onPressedChange={toggleSearch}
          >
            <Search />
          </Toggle>
        </div>
        <p className="shrink-0 text-right text-xs text-muted-foreground">
          {normalizedQuery
            ? `${matchingCount} of ${programs.length}`
            : `${programs.length} programs`}
        </p>
      </div>
      <ExplorerListbox
        labelledBy={labelledBy}
        options={
          includeAllConnections && !normalizedQuery
            ? [
                {
                  value: SHOW_ALL_CONNECTIONS,
                  label: "Show All Connections",
                  separatorAfter: true,
                },
                ...options,
              ]
            : options
        }
        value={value}
        visibleRows={9}
        onValueChange={onValueChange}
      />
      {normalizedQuery && matchingCount === 0 && (
        <p role="status" className="text-xs text-muted-foreground">
          No programs match “{query.trim()}”.
        </p>
      )}
    </>
  )
}
