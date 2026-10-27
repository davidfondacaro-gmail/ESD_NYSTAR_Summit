"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type ConnectionType = "Existing" | "Desired"

export default function MarkAllConnectionTypes({
  ids,
  types,
  onMarkAll,
  disabled,
}: {
  ids: string[]
  types: ReadonlyMap<string, ConnectionType>
  onMarkAll: (type: ConnectionType) => void
  disabled?: boolean
}) {
  const allType = (["Existing", "Desired"] as const).find(
    (type) => ids.length > 0 && ids.every((id) => types.get(id) === type)
  )

  return (
    <ToggleGroup
      aria-label="Mark all connections"
      className="w-full"
      value={allType ? [allType] : []}
      onValueChange={(value) => {
        const next = value[0]
        if (next === "Existing" || next === "Desired") onMarkAll(next)
      }}
      disabled={disabled}
      variant="outline"
      size="sm"
      spacing={0}
    >
      <ToggleGroupItem
        className="flex-1 drawer-review-control"
        value="Existing"
      >
        Mark All Existing
      </ToggleGroupItem>
      <ToggleGroupItem className="flex-1 drawer-review-control" value="Desired">
        Mark All Desired
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
