"use client"

import { useEffect, useId, useRef, useSyncExternalStore } from "react"
import { ArrowLeft, Settings, Table2 } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { useSidebar } from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { DATA_TABLES, type DataTableId } from "@/lib/data-tables"

type Setting = {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

const subscribeToHydration = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export function SettingsButton({ onOpen }: { onOpen: () => void }) {
  const { setOpen } = useSidebar()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Settings"
      title="Settings"
      data-network-settings-trigger
      onClick={() => {
        setOpen(true)
        onOpen()
      }}
    >
      <Settings aria-hidden="true" />
    </Button>
  )
}

export default function NetworkSettings({
  active,
  onBack,
  map,
  app,
}: {
  active: boolean
  onBack: () => void
  map: Setting[]
  app: Setting[]
}) {
  const id = useId()
  const backRef = useRef<HTMLButtonElement>(null)
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    clientSnapshot,
    serverSnapshot
  )
  useEffect(() => {
    if (active) backRef.current?.focus({ preventScroll: true })
  }, [active])
  const groups = [
    { title: "Map", settings: map },
    { title: "App", settings: app },
    {
      title: "Theme",
      settings: [
        {
          label: "Dark mode",
          checked: mounted && resolvedTheme === "dark",
          onCheckedChange: (dark: boolean) => setTheme(dark ? "dark" : "light"),
        },
      ],
    },
  ]
  return (
    <section
      className="network-sidebar-view network-sidebar-view--settings"
      aria-labelledby={`${id}-heading`}
      aria-hidden={!active}
      inert={!active}
    >
      <header className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Button
          ref={backRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Back to main panel"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h2 id={`${id}-heading`} className="network-sidebar__title">
          Settings
        </h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <FieldGroup>
          {groups.map((group) => (
            <FieldSet key={group.title}>
              <FieldLegend>{group.title}</FieldLegend>
              <FieldGroup className="gap-4">
                {group.settings.map((setting, index) => {
                  const controlId = `${id}-${group.title}-${index}`
                  return (
                    <Field key={setting.label} orientation="horizontal">
                      <FieldLabel htmlFor={controlId} className="flex-1">
                        {setting.label}
                      </FieldLabel>
                      <Switch
                        id={controlId}
                        checked={setting.checked}
                        onCheckedChange={setting.onCheckedChange}
                        disabled={group.title === "Theme" && !mounted}
                      />
                    </Field>
                  )
                })}
              </FieldGroup>
            </FieldSet>
          ))}
          <FieldSet>
            <FieldLegend>Data</FieldLegend>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button type="button" variant="outline" />}
              >
                <Table2 data-icon="inline-start" />
                Data tables
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                {(Object.keys(DATA_TABLES) as DataTableId[]).map((tableId) => (
                  <DropdownMenuItem
                    key={tableId}
                    render={
                      <a
                        href={`/data/${tableId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    View {DATA_TABLES[tableId].title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </FieldSet>
        </FieldGroup>
      </div>
    </section>
  )
}
