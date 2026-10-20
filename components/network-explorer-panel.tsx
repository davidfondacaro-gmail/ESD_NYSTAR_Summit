"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  ChevronRight,
  Circle,
  FileText,
  Group,
  Info,
  Link,
  Plus,
  Star,
  Tag,
  ZoomIn,
} from "lucide-react"

import AddConnectionsDrawer from "@/components/add-connections-drawer"
import ConnectProgramDrawer from "@/components/connect-program-drawer"
import ExplorerListbox from "@/components/explorer-listbox"
import InnovationPartnerPicker from "@/components/innovation-partner-picker"
import NystarProgramPicker from "@/components/nystar-program-picker"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { RecentConnection } from "@/lib/recent-connection"
import type {
  NystarLocationGroup,
  NystarProgramConnection,
  NystarProgramGroup,
} from "@/lib/nystar-locations"

type ExplorerSectionId = "program" | "partner" | "tour"

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
  showPartners,
}: {
  openSection: ExplorerSectionId | null
  onSelectSection: (section: ExplorerSectionId) => void
  showTour: boolean
  showPartners: boolean
}) {
  const { setOpen } = useSidebar()

  const items = [
    {
      id: "program",
      label: "NYSTAR Programs",
      icon: Star,
    },
    {
      id: "partner",
      label: "NYSTAR Innovation Partners",
      icon: Circle,
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
        {items
          .filter(
            ({ id }) =>
              (id !== "tour" || showTour) && (id !== "partner" || showPartners)
          )
          .map(({ id, label, icon: Icon }) => (
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

function SidebarAwareNetworkMap({
  onConnectProgram,
  ...props
}: Omit<React.ComponentProps<typeof NystarNetworkMap>, "onConnectProgram"> & {
  onConnectProgram: (programId: string, sidebarExpanded: boolean) => void
}) {
  const { isMobile, open, openMobile } = useSidebar()

  return (
    <NystarNetworkMap
      {...props}
      onConnectProgram={(programId) =>
        onConnectProgram(programId, isMobile ? openMobile : open)
      }
    />
  )
}

export default function NetworkExplorerPanel({
  locations,
  programConnections,
  categories,
  regions,
  tourRegions,
}: {
  locations: NystarLocationGroup[]
  programConnections: NystarProgramConnection[]
  categories: NystarProgramGroup[]
  regions: NystarProgramGroup[]
  tourRegions: string[]
}) {
  const programs = categories.flatMap((group) => group.programs)
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
    const partnerRegions =
      regionsByPartner.get(partner) ?? new Set(["Unassigned"])
    const region =
      partnerRegions.size > 1
        ? "Multiple Regions"
        : (partnerRegions.values().next().value ?? "Unassigned")
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
  const [selectionRevision, setSelectionRevision] = useState(0)
  const [showRegionLabels, setShowRegionLabels] = useState(true)
  const [showCityLabels, setShowCityLabels] = useState(true)
  const [showZoomControls, setShowZoomControls] = useState(false)
  const [showMapLegend, setShowMapLegend] = useState(true)
  const [clusterMarkers, setClusterMarkers] = useState(false)
  const [showTour, setShowTour] = useState(true)
  const [showPartners, setShowPartners] = useState(true)
  const [openSection, setOpenSection] = useState<ExplorerSectionId | null>(
    "program"
  )
  const router = useRouter()

  function selectSection(section: ExplorerSectionId | null) {
    if (section === "partner" && openSection !== "partner") router.refresh()
    setOpenSection(section)
  }
  const [recentConnections, setRecentConnections] = useState<
    RecentConnection[]
  >([])
  const [popupDismissRevision, setPopupDismissRevision] = useState(0)
  const [connectDrawerOpen, setConnectDrawerOpen] = useState(false)

  function startConnectionFlow() {
    setRecentConnections([])
    setPopupDismissRevision((revision) => revision + 1)
  }

  function connectFromMap(programId: string, sidebarExpanded: boolean) {
    if (programId !== selectedProgramId) {
      setSelectedProgramId(programId)
      setSelectedPartnerName("")
      setSelectionRevision((revision) => revision + 1)
    }
    if (sidebarExpanded) setOpenSection("program")
    startConnectionFlow()
    setConnectDrawerOpen(true)
  }
  const [tourStarted, setTourStarted] = useState(false)
  const [selectedTourRegion, setSelectedTourRegion] = useState("all")
  const selectedProgram = programs.find(
    (program) => program.id === selectedProgramId
  )
  const selectedPartnerConnectedAssetIds = locations.flatMap((location) =>
    location.customers
      .filter((customer) => customer.name.trim() === selectedPartnerName)
      .flatMap((customer) =>
        customer.connections.map((connection) => connection.assetId)
      )
  )
  const selectedProgramIsMapped = locations.some((location) =>
    location.assets.some((asset) => asset.id === selectedProgramId)
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
            showPartners={showPartners}
            openSection={openSection}
            onSelectSection={selectSection}
          />
          <ExplorerSection
            headingId="find-program-heading"
            icon={<Star aria-hidden="true" className="shrink-0" />}
            title="NYSTAR Programs"
            open={openSection === "program"}
            onOpenChange={(open) => setOpenSection(open ? "program" : null)}
          >
            <Alert className="border-sidebar-border bg-transparent">
              <Info aria-hidden="true" />
              <AlertDescription>
                Select a NYSTAR program to view its connections on the map.
              </AlertDescription>
            </Alert>
            <NystarProgramPicker
              categories={categories}
              regions={regions}
              labelledBy="find-program-heading"
              value={selectedProgramId}
              onValueChange={(value) => {
                setSelectedProgramId(value)
                setSelectedPartnerName("")
                setSelectionRevision((revision) => revision + 1)
              }}
            />
            {selectedProgram && (
              <ConnectProgramDrawer
                key={selectedProgram.id}
                programId={selectedProgram.id}
                programName={selectedProgram.name}
                categories={categories}
                regions={regions}
                partners={innovationPartners}
                partnerRegionGroups={partnerRegionGroups}
                onStart={startConnectionFlow}
                onSaved={setRecentConnections}
                open={connectDrawerOpen}
                onOpenChange={setConnectDrawerOpen}
              />
            )}
            {selectedProgram && !selectedProgramIsMapped && (
              <p className="mt-2 text-xs text-muted-foreground">
                This statewide program has no mapped location.
              </p>
            )}
          </ExplorerSection>

          {showPartners && (
            <ExplorerSection
              headingId="find-partner-heading"
              icon={<Circle aria-hidden="true" className="shrink-0" />}
              title="NYSTAR Innovation Partners"
              open={openSection === "partner"}
              onOpenChange={(open) => selectSection(open ? "partner" : null)}
            >
              <Alert className="border-sidebar-border bg-transparent">
                <Info aria-hidden="true" />
                <AlertDescription>
                  Select an innovation partner to view its connections on the
                  map.
                </AlertDescription>
              </Alert>
              <InnovationPartnerPicker
                partners={innovationPartners}
                regionGroups={partnerRegionGroups}
                labelledBy="find-partner-heading"
                value={selectedPartnerName}
                onValueChange={(value) => {
                  setSelectedPartnerName(value)
                  setSelectedProgramId("")
                  setSelectionRevision((revision) => revision + 1)
                }}
              />
              <AddConnectionsDrawer
                categories={categories}
                regions={regions}
                partners={innovationPartners}
                onStart={startConnectionFlow}
                onSaved={setRecentConnections}
                trigger={
                  <Button
                    type="button"
                    variant="brand-link"
                    size="inline"
                    className="gap-1.5 self-start"
                  >
                    <Plus data-icon="inline-start" />
                    Add Your Company
                  </Button>
                }
              />
              {selectedPartnerName && (
                <AddConnectionsDrawer
                  key={selectedPartnerName}
                  categories={categories}
                  regions={regions}
                  partners={innovationPartners}
                  existingPartnerName={selectedPartnerName}
                  connectedAssetIds={selectedPartnerConnectedAssetIds}
                  onStart={startConnectionFlow}
                  onSaved={setRecentConnections}
                  trigger={
                    <Button
                      type="button"
                      variant="brand-link"
                      size="inline"
                      className="shrink items-start gap-1.5 self-start text-left whitespace-normal [&_svg]:mt-0.5"
                    >
                      <Link data-icon="inline-start" />
                      Add NYSTAR Connections for {selectedPartnerName}
                    </Button>
                  }
                />
              )}
            </ExplorerSection>
          )}

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
            <Tooltip>
              <Toggle
                aria-label="Toggle marker clustering"
                pressed={clusterMarkers}
                onPressedChange={setClusterMarkers}
                variant="default"
                size="sm"
                render={<TooltipTrigger />}
              >
                <Group aria-hidden="true" />
              </Toggle>
              <TooltipContent>Toggle marker clustering</TooltipContent>
            </Tooltip>
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
                  {showRegionLabels
                    ? "Hide Region Labels"
                    : "Show Region Labels"}
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
                aria-label="Toggle innovation partners"
                pressed={showPartners}
                onPressedChange={(visible) => {
                  setShowPartners(visible)
                  if (!visible) {
                    setOpenSection((section) =>
                      section === "partner" ? null : section
                    )
                    if (selectedPartnerName) {
                      setSelectedPartnerName("")
                      setSelectionRevision((revision) => revision + 1)
                    }
                  }
                }}
                variant="default"
                size="sm"
                render={<TooltipTrigger />}
              >
                <Circle aria-hidden="true" />
              </Toggle>
              <TooltipContent>Toggle innovation partners</TooltipContent>
            </Tooltip>
            <Tooltip>
              <Toggle
                aria-label="Toggle tour"
                pressed={showTour}
                onPressedChange={(visible) => {
                  setShowTour(visible)
                  if (!visible) {
                    setTourStarted(false)
                    setOpenSection((section) =>
                      section === "tour" ? null : section
                    )
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
        <SidebarAwareNetworkMap
          onConnectProgram={connectFromMap}
          locations={locations}
          programConnections={programConnections}
          selectedProgramId={selectedProgramId}
          selectedPartnerName={selectedPartnerName}
          selectionRevision={selectionRevision}
          showZoomControls={showZoomControls}
          showMapLegend={showMapLegend}
          clusterMarkers={clusterMarkers}
          showRegionLabels={showRegionLabels}
          showCityLabels={showCityLabels}
          recentConnections={recentConnections}
          popupDismissRevision={popupDismissRevision}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
