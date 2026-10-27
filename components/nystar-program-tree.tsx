"use client"

import { ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { NystarProgramGroup } from "@/lib/nystar-locations"

export type ProgramTreeGrouping = "type" | "region"

const nameCollator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
})

function sortGroups(groups: NystarProgramGroup[]) {
  return [...groups]
    .sort((a, b) => nameCollator.compare(a.name, b.name))
    .map((group) => ({
      ...group,
      programs: [...group.programs].sort((a, b) =>
        nameCollator.compare(a.name, b.name)
      ),
    }))
}

export default function NystarProgramTree({
  categories,
  regions,
  selectedIds,
  onToggle,
  groupingMode,
  onGroupingModeChange,
  openGroups,
  onOpenGroupsChange,
  connectedIds,
  disabledIds,
  disabledNote = "Current program",
  idPrefix = "",
}: {
  categories: NystarProgramGroup[]
  regions: NystarProgramGroup[]
  selectedIds: Set<string>
  onToggle: (programId: string, checked: boolean) => void
  groupingMode: ProgramTreeGrouping
  onGroupingModeChange: (mode: ProgramTreeGrouping) => void
  openGroups: Set<string>
  onOpenGroupsChange: (groups: Set<string>) => void
  connectedIds?: Set<string>
  disabledIds?: Set<string>
  disabledNote?: string
  idPrefix?: string
}) {
  function toggleGroup(name: string, open: boolean) {
    const next = new Set(openGroups)
    if (open) next.add(name)
    else next.delete(name)
    onOpenGroupsChange(next)
  }

  return (
    <FieldGroup className="gap-3">
      <div className="flex w-full items-center justify-between gap-3">
        <ToggleGroup
          aria-label="Organize by"
          value={[groupingMode]}
          onValueChange={(value) => {
            const nextMode = value[0]
            if (nextMode === "type" || nextMode === "region") {
              onGroupingModeChange(nextMode)
              onOpenGroupsChange(new Set())
            }
          }}
          variant="outline"
          size="sm"
          spacing={0}
        >
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
        <p className="shrink-0 text-right text-sm text-muted-foreground">
          {selectedIds.size} selected
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {sortGroups(groupingMode === "type" ? categories : regions).map((group) => {
          const open = openGroups.has(group.name)
          return (
            <li key={`${groupingMode}-${group.name}`}>
              <Collapsible
                open={open}
                onOpenChange={(nextOpen) => toggleGroup(group.name, nextOpen)}
                className="rounded-md border border-border"
              >
                <CollapsibleTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto min-h-8 w-full justify-start gap-2 px-3 py-3 text-left whitespace-normal"
                    />
                  }
                >
                  <ChevronRight
                    aria-hidden="true"
                    className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
                    data-icon="inline-start"
                  />
                  <span>{group.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {group.programs.length}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t border-border px-3 py-2">
                  <FieldGroup className="gap-1">
                    {group.programs.map((program) => {
                      const checkboxId = `${idPrefix}${program.id}`
                      const disabled = disabledIds?.has(program.id) ?? false
                      return (
                        <Field
                          key={program.id}
                          orientation="horizontal"
                          data-disabled={disabled || undefined}
                          className="items-start gap-3 rounded-sm py-2"
                        >
                          <Checkbox
                            id={checkboxId}
                            checked={selectedIds.has(program.id)}
                            disabled={disabled}
                            onCheckedChange={(checked) =>
                              onToggle(program.id, checked === true)
                            }
                          />
                          <FieldContent>
                            <FieldLabel
                              htmlFor={checkboxId}
                              className="cursor-pointer drawer-field-label"
                            >
                              {program.name}
                            </FieldLabel>
                            {program.details && (
                              <FieldDescription className="text-xs">
                                {groupingMode === "region"
                                  ? `${program.category} · ${program.details}`
                                  : program.details}
                              </FieldDescription>
                            )}
                            {disabled ? (
                              <FieldDescription className="text-xs">
                                {disabledNote}
                              </FieldDescription>
                            ) : connectedIds?.has(program.id) && (
                              <FieldDescription className="text-xs">
                                Already connected
                              </FieldDescription>
                            )}
                          </FieldContent>
                        </Field>
                      )
                    })}
                  </FieldGroup>
                </CollapsibleContent>
              </Collapsible>
            </li>
          )
        })}
      </ul>
    </FieldGroup>
  )
}
