"use client"

import { Fragment, useEffect, useId, useRef, useState } from "react"
import {
  ArrowRight,
  ChevronRight,
  Circle,
  FileText,
  Info,
  Link,
  Star,
  Tag,
  ZoomIn,
} from "lucide-react"

import AddConnectionsDrawer from "@/components/add-connections-drawer"
import NystarNetworkMap from "@/components/nystar-network-map"
import ThemeToggleButton from "@/components/theme-toggle-button"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import type {
  NystarLocationGroup,
  NystarProgramOption,
  NystarProgramGroup,
} from "@/lib/nystar-locations"

type ProgramGrouping = "alpha" | "type" | "region"
type PartnerGrouping = "alpha" | "region"
type ExplorerSectionId = "program" | "partner" | "connections" | "tour"

function comparePrograms(left: NystarProgramOption, right: NystarProgramOption) {
  return (
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
    left.id.localeCompare(right.id)
  )
}

type ExplorerListboxOption = {
  value: string
  label: string
  group?: string
}

function ExplorerListbox({
  labelledBy,
  options,
  value,
  visibleRows,
  onValueChange,
}: {
  labelledBy: string
  options: ExplorerListboxOption[]
  value: string
  visibleRows: number
  onValueChange: (value: string) => void
}) {
  const listboxId = useId()
  const listboxRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef(new Map<string, HTMLDivElement>())
  const typeahead = useRef("")
  const typeaheadTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeValue, setActiveValue] = useState(
    value || options[0]?.value || ""
  )
  const activeIndex = options.findIndex(
    (option) => option.value === activeValue
  )
  const selectedIndex = options.findIndex((option) => option.value === value)
  const resolvedActiveIndex =
    activeIndex >= 0 ? activeIndex : Math.max(selectedIndex, 0)
  const activeOption = options[resolvedActiveIndex]
  const activeOptionValue = activeOption?.value
  const optionKey = options.map((option) => option.value).join("\0")
  const groupedOptions = options.reduce<
    { label?: string; options: ExplorerListboxOption[] }[]
  >((groups, option) => {
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.label === option.group) {
      lastGroup.options.push(option)
    } else {
      groups.push({ label: option.group, options: [option] })
    }
    return groups
  }, [])

  useEffect(() => {
    if (activeOptionValue) {
      optionRefs.current
        .get(activeOptionValue)
        ?.scrollIntoView({ block: "nearest" })
    }
  }, [activeOptionValue, optionKey])

  function selectAt(index: number) {
    const nextOption = options[Math.max(0, Math.min(index, options.length - 1))]
    if (!nextOption) return
    setActiveValue(nextOption.value)
    onValueChange(nextOption.value)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      selectAt(resolvedActiveIndex + (event.key === "ArrowDown" ? 1 : -1))
      return
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault()
      selectAt(event.key === "Home" ? 0 : options.length - 1)
      return
    }
    if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault()
      const offset = event.key === "PageDown" ? visibleRows : -visibleRows
      selectAt(resolvedActiveIndex + offset)
      return
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (activeOption) onValueChange(activeOption.value)
      return
    }
    if (
      event.key.length !== 1 ||
      event.key === " " ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return
    }

    event.preventDefault()
    typeahead.current += event.key.toLocaleLowerCase()
    if (typeaheadTimeout.current) clearTimeout(typeaheadTimeout.current)
    typeaheadTimeout.current = setTimeout(() => {
      typeahead.current = ""
      typeaheadTimeout.current = null
    }, 700)

    const query = typeahead.current
    const searchOptions = [
      ...options.slice(resolvedActiveIndex + 1),
      ...options.slice(0, resolvedActiveIndex + 1),
    ]
    const match = searchOptions.find((option) =>
      option.label.toLocaleLowerCase().startsWith(query)
    )
    if (match) selectAt(options.indexOf(match))
  }

  function renderOption(option: ExplorerListboxOption) {
    const optionIndex = options.indexOf(option)
    return (
      <div
        key={option.value}
        id={`${listboxId}-option-${optionIndex}`}
        ref={(element) => {
          if (element) optionRefs.current.set(option.value, element)
          else optionRefs.current.delete(option.value)
        }}
        role="option"
        aria-selected={option.value === value}
        data-active={option.value === activeOptionValue}
        className="network-listbox-option flex min-h-6 cursor-pointer items-center rounded-sm px-2 py-0.5 leading-5"
        title={option.label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setActiveValue(option.value)
          onValueChange(option.value)
          listboxRef.current?.focus()
        }}
      >
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
      </div>
    )
  }

  return (
    <div
      ref={listboxRef}
      id={listboxId}
      role="listbox"
      tabIndex={0}
      aria-labelledby={labelledBy}
      aria-activedescendant={
        activeOption ? `${listboxId}-option-${resolvedActiveIndex}` : undefined
      }
      className="network-listbox max-h-60 w-full overflow-y-auto rounded-md border border-input bg-background p-1 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      style={{ height: `${visibleRows * 24}px` }}
      onKeyDown={handleKeyDown}
    >
      {groupedOptions.map((group, index) => (
        <Fragment key={group.label ?? `ungrouped-${index}`}>
          {group.label ? (
            <div role="group" aria-label={group.label}>
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                {group.label}
              </div>
              {group.options.map(renderOption)}
            </div>
          ) : (
            group.options.map(renderOption)
          )}
        </Fragment>
      ))}
    </div>
  )
}

function ExplorerSection({
  headingId,
  icon,
  title,
  open,
  onOpenChange,
  children,
}: {
  headingId: string
  icon: React.ReactNode
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <SidebarGroup className="p-0 group-data-[collapsible=icon]:hidden">
      <Card
        size="sm"
        className="rounded-md border border-sidebar-border bg-sidebar p-0 shadow-none ring-0"
      >
        <CardContent className="p-2">
          <div
            data-open={open ? "" : undefined}
            className="rounded-md data-open:bg-sidebar-accent/40"
          >
            <Button
              type="button"
              variant="ghost"
              aria-expanded={open}
              aria-controls={`${headingId}-panel`}
              onClick={() => onOpenChange(!open)}
              className="group h-auto min-h-11 w-full justify-between gap-3 rounded-md px-3 py-3 text-left whitespace-normal"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {icon}
                <span id={headingId} className="min-w-0 whitespace-normal">
                  {title}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="shrink-0 transition-transform group-aria-expanded:rotate-90"
                data-icon="inline-end"
              />
            </Button>
            <div
              id={`${headingId}-panel`}
              role="region"
              aria-labelledby={headingId}
              aria-hidden={!open}
              inert={!open}
              data-open={open ? "" : undefined}
              className="network-collapsible-panel"
            >
              <div className="network-collapsible-panel__inner">
                <div className="flex flex-col gap-3 px-3 pt-1 pb-3 text-sm">
                {children}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </SidebarGroup>
  )
}

function CollapsedExplorerNavigation({
  openSection,
  onSelectSection,
  showTour,
}: {
  openSection: ExplorerSectionId | null
  onSelectSection: (section: ExplorerSectionId) => void
  showTour: boolean
}) {
  const { setOpen } = useSidebar()

  const items = [
    {
      id: "program",
      label: "Find a NYSTAR Program",
      icon: Star,
    },
    {
      id: "partner",
      label: "Find an Innovation Partner",
      icon: Circle,
    },
    {
      id: "connections",
      label: "Add a Program, Partner, or Connections",
      icon: Link,
    },
    {
      id: "tour",
      label: "Take a Guided Tour of the Network",
      icon: ArrowRight,
    },
  ] as const

  return (
    <SidebarGroup className="hidden p-0 group-data-[collapsible=icon]:block">
      <SidebarMenu className="gap-1">
        {items.filter(({ id }) => id !== "tour" || showTour).map(({ id, label, icon: Icon }) => (
          <SidebarMenuItem key={id}>
            <SidebarMenuButton
              aria-label={label}
              isActive={openSection === id}
              onClick={() => {
                onSelectSection(id)
                setOpen(true)
              }}
              tooltip={label}
              className="justify-center text-sidebar-foreground"
            >
              <Icon aria-hidden="true" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export default function NetworkExplorerPanel({
  locations,
  categories,
  regions,
  tourRegions,
}: {
  locations: NystarLocationGroup[]
  categories: NystarProgramGroup[]
  regions: NystarProgramGroup[]
  tourRegions: string[]
}) {
  const programs = categories
    .flatMap((group) => group.programs)
    .sort(comparePrograms)
  const innovationPartners = Array.from(
    new Set(
      locations
        .flatMap((location) =>
          location.customers.map((customer) => customer.name)
        )
        .map((name) => name.trim())
        .filter(Boolean)
    )
  ).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" })
  )
  const regionsByPartner = new Map<string, Set<string>>()
  const addPartnerRegion = (partner: string, region?: string) => {
    const partnerRegions = regionsByPartner.get(partner) ?? new Set<string>()
    partnerRegions.add(region ?? "Unassigned")
    regionsByPartner.set(partner, partnerRegions)
  }

  for (const location of locations) {
    for (const customer of location.customers) {
      addPartnerRegion(customer.name.trim(), customer.region)
    }
  }

  const partnersByRegion = new Map<string, string[]>()
  for (const partner of innovationPartners) {
    const partnerRegions = regionsByPartner.get(partner) ?? new Set(["Unassigned"])
    const region =
      partnerRegions.size > 1
        ? "Multiple Regions"
        : partnerRegions.values().next().value ?? "Unassigned"
    const partners = partnersByRegion.get(region) ?? []
    partners.push(partner)
    partnersByRegion.set(region, partners)
  }
  const partnerRegionGroups = [...partnersByRegion.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, partners]) => ({
      name,
      partners: partners.sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: "base" })
      ),
    }))

  const [selectedProgramId, setSelectedProgramId] = useState("")
  const [selectedPartnerName, setSelectedPartnerName] = useState("")
  const [showRegionLabels, setShowRegionLabels] = useState(true)
  const [showCityLabels, setShowCityLabels] = useState(true)
  const [showZoomControls, setShowZoomControls] = useState(false)
  const [showMapLegend, setShowMapLegend] = useState(true)
  const [showTour, setShowTour] = useState(true)
  const [programGrouping, setProgramGrouping] = useState<ProgramGrouping>(
    "alpha"
  )
  const [partnerGrouping, setPartnerGrouping] = useState<PartnerGrouping>(
    "alpha"
  )
  const [openSection, setOpenSection] = useState<ExplorerSectionId | null>(
    "program"
  )
  const [tourStarted, setTourStarted] = useState(false)
  const [selectedTourRegion, setSelectedTourRegion] = useState("all")
  const selectedProgram = programs.find(
    (program) => program.id === selectedProgramId
  )
  const selectedProgramIsMapped = locations.some((location) =>
    location.assets.some((asset) => asset.id === selectedProgramId)
  )
  const programOptions =
    programGrouping === "alpha"
      ? programs.map((program) => ({ value: program.id, label: program.name }))
      : (programGrouping === "type" ? categories : regions).flatMap((group) =>
          [...group.programs]
            .sort(comparePrograms)
            .map((program) => ({
              value: program.id,
              label: program.name,
              group: `- ${group.name}`,
            }))
        )
  const partnerOptions =
    partnerGrouping === "alpha"
      ? innovationPartners.map((partner) => ({ value: partner, label: partner }))
      : partnerRegionGroups.flatMap((group) =>
          group.partners.map((partner) => ({
            value: partner,
            label: partner,
            group: `- ${group.name}`,
          }))
        )
  const tourRegionOptions = [
    { value: "all", label: "All Regions" },
    ...tourRegions.map((region) => ({ value: region, label: region })),
  ]

  return (
    <SidebarProvider className="network-screen">
      <Sidebar collapsible="icon">
        <SidebarHeader className="flex-row items-start justify-between gap-2 px-4 pt-5 pb-3">
          <h1 className="network-sidebar__title group-data-[collapsible=icon]:hidden">
            The NYSTAR Innovation Network
          </h1>
          <SidebarTrigger className="ml-auto" title="Toggle sidebar" />
        </SidebarHeader>
        <SidebarContent className="min-h-0 gap-3 px-3 py-3 group-data-[collapsible=icon]:px-2">
          <CollapsedExplorerNavigation
            showTour={showTour}
            openSection={openSection}
            onSelectSection={setOpenSection}
          />
          <ExplorerSection
            headingId="find-program-heading"
            icon={<Star aria-hidden="true" className="shrink-0" />}
            title="Find a NYSTAR Program"
            open={openSection === "program"}
            onOpenChange={(open) =>
              setOpenSection(open ? "program" : null)
            }
          >
            <Alert className="border-sidebar-border bg-transparent">
              <Info aria-hidden="true" />
              <AlertDescription>
                Select a NYSTAR program to view its connections on the map.
              </AlertDescription>
            </Alert>
            <div className="flex items-center justify-between gap-2">
              <ToggleGroup
                aria-label="Group programs by"
                value={[programGrouping]}
                onValueChange={(value) => {
                  const nextGrouping = value[0]
                  if (
                    nextGrouping === "alpha" ||
                    nextGrouping === "type" ||
                    nextGrouping === "region"
                  ) {
                    setProgramGrouping(nextGrouping)
                  }
                }}
                variant="outline"
                size="sm"
                spacing={0}
              >
                <ToggleGroupItem
                  className="drawer-review-control"
                  value="alpha"
                >
                  A to Z
                </ToggleGroupItem>
                <ToggleGroupItem
                  className="drawer-review-control"
                  value="type"
                >
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
              labelledBy="find-program-heading"
              options={programOptions}
              value={selectedProgramId}
              visibleRows={9}
              onValueChange={(value) => {
                setSelectedProgramId(value)
                setSelectedPartnerName("")
              }}
            />
            {selectedProgram && !selectedProgramIsMapped && (
              <p className="mt-2 text-xs text-muted-foreground">
                This statewide program has no mapped location.
              </p>
            )}
          </ExplorerSection>

          <ExplorerSection
            headingId="find-partner-heading"
            icon={<Circle aria-hidden="true" className="shrink-0" />}
            title="Find an Innovation Partner"
            open={openSection === "partner"}
            onOpenChange={(open) =>
              setOpenSection(open ? "partner" : null)
            }
          >
            <Alert className="border-sidebar-border bg-transparent">
              <Info aria-hidden="true" />
              <AlertDescription>
                Select an innovation partner to view its connections on the map.
              </AlertDescription>
            </Alert>
            <div className="flex items-center justify-between gap-2">
              <ToggleGroup
                aria-label="Group innovation partners by"
                value={[partnerGrouping]}
                onValueChange={(value) => {
                  const nextGrouping = value[0]
                  if (nextGrouping === "alpha" || nextGrouping === "region") {
                    setPartnerGrouping(nextGrouping)
                  }
                }}
                variant="outline"
                size="sm"
                spacing={0}
              >
                <ToggleGroupItem
                  className="drawer-review-control"
                  value="alpha"
                >
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
                {innovationPartners.length} partners
              </p>
            </div>
            <ExplorerListbox
              labelledBy="find-partner-heading"
              options={partnerOptions}
              value={selectedPartnerName}
              visibleRows={7}
              onValueChange={(value) => {
                setSelectedPartnerName(value)
                setSelectedProgramId("")
              }}
            />
          </ExplorerSection>

          <ExplorerSection
            headingId="add-connections-heading"
            icon={<Link aria-hidden="true" className="shrink-0" />}
            title="Add a Program, Partner, or Connections"
            open={openSection === "connections"}
            onOpenChange={(open) =>
              setOpenSection(open ? "connections" : null)
            }
          >
            <AddConnectionsDrawer categories={categories} regions={regions} />
          </ExplorerSection>

          {showTour && (
            <ExplorerSection
              headingId="guided-tour-heading"
              icon={<ArrowRight aria-hidden="true" className="shrink-0" />}
              title="Take a Guided Tour of the Network"
              open={openSection === "tour"}
              onOpenChange={(open) => setOpenSection(open ? "tour" : null)}
            >
              <Alert className="border-sidebar-border bg-transparent">
                <Info aria-hidden="true" />
                <AlertDescription>
                  Select a region below to start your tour.
                </AlertDescription>
              </Alert>
              <ExplorerListbox
                labelledBy="guided-tour-heading"
                options={tourRegionOptions}
                value={selectedTourRegion}
                visibleRows={6}
                onValueChange={setSelectedTourRegion}
              />
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="bg-brand-blue-primary text-white hover:bg-brand-blue-primary/90"
                  onClick={() => setTourStarted((started) => !started)}
                >
                  {tourStarted ? "Exit Tour" : "Start Tour"}
                </Button>
                {tourStarted && (
                  <div className="ml-auto flex items-center gap-2">
                    <Button type="button" variant="brand-outline" size="sm">
                      Next
                    </Button>
                    <Button type="button" variant="brand-outline" size="sm">
                      Auto
                    </Button>
                  </div>
                )}
              </div>
            </ExplorerSection>
          )}
        </SidebarContent>
        <SidebarFooter className="items-end">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Toggle labels"
                    title="Toggle labels"
                  />
                }
              >
                <Tag aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-48">
                <DropdownMenuCheckboxItem
                  checked={showRegionLabels}
                  onCheckedChange={setShowRegionLabels}
                >
                  {showRegionLabels ? "Hide Region Labels" : "Show Region Labels"}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showCityLabels}
                  onCheckedChange={setShowCityLabels}
                >
                  {showCityLabels ? "Hide City Labels" : "Show City Labels"}
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Toggle
              aria-label="Toggle map zoom controls"
              title="Toggle map zoom controls"
              pressed={showZoomControls}
              onPressedChange={setShowZoomControls}
              variant="default"
              size="sm"
            >
              <ZoomIn aria-hidden="true" />
            </Toggle>
            <Toggle
              aria-label="Toggle map legend"
              title="Toggle map legend"
              pressed={showMapLegend}
              onPressedChange={setShowMapLegend}
              variant="default"
              size="sm"
            >
              <FileText aria-hidden="true" />
            </Toggle>
            <Tooltip>
              <Toggle
                aria-label="Toggle tour"
                pressed={showTour}
                onPressedChange={(visible) => {
                  setShowTour(visible)
                  if (!visible) {
                    setTourStarted(false)
                    setOpenSection((section) => section === "tour" ? null : section)
                  }
                }}
                variant="default"
                size="sm"
                render={<TooltipTrigger />}
              >
                <ArrowRight aria-hidden="true" />
              </Toggle>
              <TooltipContent>Toggle tour</TooltipContent>
            </Tooltip>
            <ThemeToggleButton />
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="network-map-panel">
        <SidebarTrigger
          className="network-map-sidebar-trigger md:hidden"
          title="Toggle sidebar"
        />
        <NystarNetworkMap
          locations={locations}
          selectedProgramId={selectedProgramId}
          selectedPartnerName={selectedPartnerName}
          showZoomControls={showZoomControls}
          showMapLegend={showMapLegend}
          showRegionLabels={showRegionLabels}
          showCityLabels={showCityLabels}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}