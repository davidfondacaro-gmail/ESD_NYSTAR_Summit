"use client"

import { useState } from "react"

import ExplorerListbox from "@/components/explorer-listbox"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type PartnerGrouping = "alpha" | "region"

export type PartnerRegionGroup = {
  name: string
  partners: string[]
}

export default function InnovationPartnerPicker({
  partners,
  regionGroups,
  labelledBy,
  value,
  visibleRows = 7,
  onValueChange,
}: {
  partners: string[]
  regionGroups: PartnerRegionGroup[]
  labelledBy: string
  value: string
  visibleRows?: number
  onValueChange: (value: string) => void
}) {
  const [grouping, setGrouping] = useState<PartnerGrouping>("alpha")
  const options =
    grouping === "alpha"
      ? partners.map((partner) => ({ value: partner, label: partner }))
      : regionGroups.flatMap((group) =>
          group.partners.map((partner) => ({
            value: partner,
            label: partner,
            group: `- ${group.name}`,
          }))
        )

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <ToggleGroup
          aria-label="Group innovation partners by"
          value={[grouping]}
          onValueChange={(value) => {
            const nextGrouping = value[0]
            if (nextGrouping === "alpha" || nextGrouping === "region") {
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
          {partners.length} partners
        </p>
      </div>
      <ExplorerListbox
        labelledBy={labelledBy}
        options={options}
        value={value}
        visibleRows={visibleRows}
        onValueChange={onValueChange}
      />
    </>
  )
}
