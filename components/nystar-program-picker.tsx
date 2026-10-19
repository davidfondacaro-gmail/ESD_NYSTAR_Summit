"use client"

import { useState } from "react"

import ExplorerListbox from "@/components/explorer-listbox"
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
}: {
  categories: NystarProgramGroup[]
  regions: NystarProgramGroup[]
  labelledBy: string
  value: string
  onValueChange: (value: string) => void
}) {
  const [grouping, setGrouping] = useState<ProgramGrouping>("alpha")
  const programs = categories
    .flatMap((group) => group.programs)
    .sort(comparePrograms)
  const options =
    grouping === "alpha"
      ? programs.map((program) => ({ value: program.id, label: program.name }))
      : (grouping === "type" ? categories : regions).flatMap((group) =>
          [...group.programs].sort(comparePrograms).map((program) => ({
            value: program.id,
            label: program.name,
            group: `- ${group.name}`,
          }))
        )

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
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
            <TooltipContent>Empire State Development regions</TooltipContent>
          </Tooltip>
        </ToggleGroup>
        <p className="shrink-0 text-right text-xs text-muted-foreground">
          {programs.length} programs
        </p>
      </div>
      <ExplorerListbox
        labelledBy={labelledBy}
        options={options}
        value={value}
        visibleRows={9}
        onValueChange={onValueChange}
      />
    </>
  )
}
