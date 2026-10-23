"use client"

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  ChevronRight,
  Circle,
  Diamond,
  Info,
  Link,
  Plus,
} from "lucide-react"

import AddConnectionsDrawer from "@/components/add-connections-drawer"
import ConnectProgramDrawer from "@/components/connect-program-drawer"
import ExplorerListbox from "@/components/explorer-listbox"
import InnovationPartnerPicker from "@/components/innovation-partner-picker"
import NystarProgramPicker, {
  SHOW_ALL_CONNECTIONS,
} from "@/components/nystar-program-picker"
import type { MapItemSelection } from "@/components/nystar-leaflet-map"
import NystarNetworkMap from "@/components/nystar-network-map"
import NetworkSettings, { SettingsButton } from "@/components/network-settings"
import { Button } from "@/components/ui/button"
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
import {
  buildTourStops,
  nextTourIndex,
  scopedTourStops,
  TOUR_DWELL_MS,
} from "@/lib/network-tour"
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
      icon: Diamond,
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
  onSelectItem,
  onConnectPartner,
  ...props
}: Omit<
  React.ComponentProps<typeof NystarNetworkMap>,
  "onConnectProgram" | "onSelectItem" | "onConnectPartner"
> & {
  onConnectProgram: (programId: string, sidebarExpanded: boolean) => void
  onSelectItem: (item: MapItemSelection, sidebarExpanded: boolean) => void
  onConnectPartner: (partnerName: string, sidebarExpanded: boolean) => void
}) {
  const { isMobile, open, openMobile } = useSidebar()

  return (
    <NystarNetworkMap
      {...props}
      onConnectProgram={(programId) =>
        onConnectProgram(programId, isMobile ? openMobile : open)
      }
      onSelectItem={(item) => onSelectItem(item, isMobile ? openMobile : open)}
      onConnectPartner={(name) =>
        onConnectPartner(name, isMobile ? openMobile : open)
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

  const [selectedProgramId, setSelectedProgramId] =
    useState(SHOW_ALL_CONNECTIONS)
  const [selectedPartnerName, setSelectedPartnerName] = useState("")
  const [selectionRevision, setSelectionRevision] = useState(0)
  const [showRegionLabels, setShowRegionLabels] = useState(true)
  const [showCityLabels, setShowCityLabels] = useState(true)
  const [showZoomControls, setShowZoomControls] = useState(false)
  const [showMapLegend, setShowMapLegend] = useState(true)
  const [clusterMarkers, setClusterMarkers] = useState(false)
  const [showTour, setShowTour] = useState(true)
  const [showPartners, setShowPartners] = useState(true)
  const [showInstructions, setShowInstructions] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const mainPanelRef = useRef<HTMLDivElement>(null)
  const [openSection, setOpenSection] = useState<ExplorerSectionId | null>(
    "program"
  )
  const router = useRouter()

  function selectSection(section: ExplorerSectionId | null) {
    if (section !== "tour") pauseTour()
    if (section === "partner" && openSection !== "partner") router.refresh()
    setOpenSection(section)
  }
  const [recentConnections, setRecentConnections] = useState<
    RecentConnection[]
  >([])
  const [popupDismissRevision, setPopupDismissRevision] = useState(0)
  const [connectDrawerOpen, setConnectDrawerOpen] = useState(false)
  const [partnerConnectionsOpen, setPartnerConnectionsOpen] = useState(false)

  function startConnectionFlow() {
    interruptTour()
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
  function connectPartnerFromMap(
    partnerName: string,
    sidebarExpanded: boolean
  ) {
    setSelectedPartnerName(partnerName)
    setSelectedProgramId("")
    setSelectionRevision((revision) => revision + 1)
    setShowPartners(true)
    if (sidebarExpanded) setOpenSection("partner")
    startConnectionFlow()
    setPartnerConnectionsOpen(true)
  }
  function selectFromMap(item: MapItemSelection, sidebarExpanded: boolean) {
    interruptTour()
    setRecentConnections([])
    if (item.kind === "program") {
      setSelectedProgramId(item.id)
      setSelectedPartnerName("")
    } else {
      setSelectedPartnerName(item.name)
      setSelectedProgramId("")
    }
    setSelectionRevision((revision) => revision + 1)
    if (sidebarExpanded) {
      selectSection(item.kind === "program" ? "program" : "partner")
    }
  }
  function clearMapSelection() {
    interruptTour()
    setRecentConnections([])
    setSelectedProgramId("")
    setSelectedPartnerName("")
    setSelectionRevision((revision) => revision + 1)
  }
  const tourStops = useMemo(
    () => buildTourStops(regions, locations),
    [regions, locations]
  )
  const [tour, setTour] = useState<{
    scope: string
    index: number
    started: boolean
    playing: boolean
    ownsMap: boolean
  }>({ scope: "all", index: 0, started: false, playing: false, ownsMap: false })
  const [tourStatus, setTourStatus] = useState<{
    revision: number
    error: string | null
  }>({
    revision: -1,
    error: null,
  })
  const [tourExitRevision, setTourExitRevision] = useState(0)
  const scopedStops = useMemo(
    () => scopedTourStops(tourStops, tour.scope),
    [tourStops, tour.scope]
  )
  const tourStop = tour.started ? scopedStops[tour.index] : undefined
  const activeTourRegion = tour.ownsMap ? (tourStop?.region ?? null) : null
  const onTourStatus = useCallback((revision: number, error: string | null) => {
    setTourStatus({ revision, error })
  }, [])

  function pauseTour() {
    setTour((current) =>
      current.playing ? { ...current, playing: false } : current
    )
  }
  function interruptTour() {
    setTour((current) => ({ ...current, playing: false, ownsMap: false }))
  }
  function showTourStop(stop: (typeof tourStops)[number] | undefined) {
    setSelectedProgramId(stop?.assetId ?? "")
    setSelectedPartnerName("")
    setSelectionRevision((revision) => revision + 1)
  }
  function startTour(scope: string) {
    const stops = scopedTourStops(tourStops, scope)
    setTour({
      scope,
      index: 0,
      started: true,
      playing: false,
      ownsMap: stops.length > 0,
    })
    showTourStop(stops[0])
  }
  function advanceTour(playing: boolean) {
    const index = nextTourIndex(tour.index, scopedStops.length)
    setTour({ ...tour, index, playing, ownsMap: true })
    showTourStop(scopedStops[index])
  }
  const autoAdvance = useEffectEvent(() => advanceTour(true))
  useEffect(() => {
    if (
      !tour.playing ||
      !showTour ||
      openSection !== "tour" ||
      tourStatus.revision !== selectionRevision ||
      tourStatus.error
    )
      return
    const timer = window.setTimeout(() => autoAdvance(), TOUR_DWELL_MS)
    return () => window.clearTimeout(timer)
  }, [tour, showTour, openSection, tourStatus, selectionRevision])

  function exitTour() {
    setTour({ ...tour, started: false, playing: false, ownsMap: false })
    showTourStop(undefined)
    setTourExitRevision((revision) => revision + 1)
  }
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
        <div className="network-sidebar-views" data-settings={settingsOpen}>
          <div
            ref={mainPanelRef}
            className="network-sidebar-view network-sidebar-view--main"
            aria-hidden={settingsOpen}
            inert={settingsOpen}
            onTransitionEnd={(event) => {
              if (
                !settingsOpen &&
                event.target === event.currentTarget &&
                event.propertyName === "transform"
              ) {
                event.currentTarget
                  .querySelector<HTMLButtonElement>(
                    "[data-network-settings-trigger]"
                  )
                  ?.focus()
              }
            }}
          >
            <SidebarHeader className="flex-row items-start justify-between gap-2 px-4 pt-5 pb-3">
              <div className="flex min-w-0 flex-col gap-1 group-data-[collapsible=icon]:hidden">
                <h1 className="network-sidebar__title">
                  Making Connections Map
                </h1>
                <p className="text-sm text-muted-foreground">
                  The NYSTSAR Innovation Network
                </p>
              </div>
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
                icon={<Diamond aria-hidden="true" className="shrink-0" />}
                title="NYSTAR Programs"
                open={openSection === "program"}
                onOpenChange={(open) => selectSection(open ? "program" : null)}
              >
                {showInstructions && (
                  <Alert className="border-sidebar-border bg-transparent">
                    <Info aria-hidden="true" />
                    <AlertDescription>
                      Select a NYSTAR program to view its connections, or select
                      Show All Connections to view the full network.
                    </AlertDescription>
                  </Alert>
                )}
                <NystarProgramPicker
                  includeAllConnections
                  categories={categories}
                  regions={regions}
                  labelledBy="find-program-heading"
                  value={selectedProgramId}
                  onValueChange={(value) => {
                    interruptTour()
                    setRecentConnections([])
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
                    locations={locations}
                    programConnections={programConnections}
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
                  onOpenChange={(open) =>
                    selectSection(open ? "partner" : null)
                  }
                >
                  {showInstructions && (
                    <Alert className="border-sidebar-border bg-transparent">
                      <Info aria-hidden="true" />
                      <AlertDescription>
                        Select an innovation partner to view its connections on
                        the map.
                      </AlertDescription>
                    </Alert>
                  )}
                  <InnovationPartnerPicker
                    partners={innovationPartners}
                    regionGroups={partnerRegionGroups}
                    labelledBy="find-partner-heading"
                    value={selectedPartnerName}
                    onValueChange={(value) => {
                      interruptTour()
                      setRecentConnections([])
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
                      open={partnerConnectionsOpen}
                      onOpenChange={setPartnerConnectionsOpen}
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
                  onOpenChange={(open) => selectSection(open ? "tour" : null)}
                >
                  {showInstructions && (
                    <Alert className="border-sidebar-border bg-transparent">
                      <Info aria-hidden="true" />
                      <AlertDescription>
                        Select a region, then choose Start Tour. Next advances
                        one program; Auto displays each program and its popup
                        for 4 seconds. The statewide inset shows the current
                        program and its connections.
                      </AlertDescription>
                    </Alert>
                  )}
                  <ExplorerListbox
                    labelledBy="guided-tour-heading"
                    options={tourRegionOptions}
                    value={tourStop?.region ?? tour.scope}
                    visibleRows={6}
                    onValueChange={(scope) =>
                      tour.started
                        ? startTour(scope)
                        : setTour({ ...tour, scope, index: 0 })
                    }
                  />
                  {tour.started && !tourStop && (
                    <p className="text-sm text-muted-foreground">
                      No mapped NYSTAR programs in this region.
                    </p>
                  )}
                  {tour.ownsMap &&
                    tourStatus.revision === selectionRevision &&
                    tourStatus.error && (
                      <Alert variant="destructive">
                        <Info aria-hidden="true" />
                        <AlertDescription>{tourStatus.error}</AlertDescription>
                      </Alert>
                    )}
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() =>
                        tour.started ? exitTour() : startTour(tour.scope)
                      }
                    >
                      {tour.started ? "Exit Tour" : "Start Tour"}
                    </Button>
                    {tour.started && (
                      <div className="ml-auto flex items-center gap-2">
                        <Button
                          type="button"
                          variant="brand-outline"
                          size="sm"
                          disabled={!tourStop}
                          onClick={() => advanceTour(false)}
                        >
                          Next
                        </Button>
                        <Button
                          type="button"
                          variant="brand-outline"
                          size="sm"
                          disabled={!tourStop}
                          onClick={() => {
                            if (tour.playing) pauseTour()
                            else {
                              setTour({ ...tour, playing: true, ownsMap: true })
                              if (!tour.ownsMap) showTourStop(tourStop)
                            }
                          }}
                        >
                          {tour.playing ? "Pause" : "Auto"}
                        </Button>
                      </div>
                    )}
                  </div>
                </ExplorerSection>
              )}
            </SidebarContent>
            <SidebarFooter className="items-end">
              <SettingsButton
                onOpen={() => {
                  pauseTour()
                  setSettingsOpen(true)
                }}
              />
            </SidebarFooter>
          </div>
          <NetworkSettings
            active={settingsOpen}
            onBack={() => {
              setSettingsOpen(false)
              requestAnimationFrame(() =>
                mainPanelRef.current
                  ?.querySelector<HTMLButtonElement>(
                    "[data-network-settings-trigger]"
                  )
                  ?.focus()
              )
            }}
            map={[
              {
                label: "Marker clustering",
                checked: clusterMarkers,
                onCheckedChange: setClusterMarkers,
              },
              {
                label: "Region labels",
                checked: showRegionLabels,
                onCheckedChange: setShowRegionLabels,
              },
              {
                label: "City labels",
                checked: showCityLabels,
                onCheckedChange: setShowCityLabels,
              },
              {
                label: "Zoom controls",
                checked: showZoomControls,
                onCheckedChange: setShowZoomControls,
              },
              {
                label: "Legend",
                checked: showMapLegend,
                onCheckedChange: setShowMapLegend,
              },
            ]}
            app={[
              {
                label: "Innovation partners",
                checked: showPartners,
                onCheckedChange: (visible) => {
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
                },
              },
              {
                label: "Instructions",
                checked: showInstructions,
                onCheckedChange: setShowInstructions,
              },
              {
                label: "Guided tour",
                checked: showTour,
                onCheckedChange: (visible) => {
                  setShowTour(visible)
                  if (!visible) {
                    pauseTour()
                    setOpenSection((section) =>
                      section === "tour" ? null : section
                    )
                  }
                },
              },
            ]}
          />
        </div>
      </Sidebar>
      <SidebarInset className="network-map-panel">
        <SidebarTrigger
          className="network-map-sidebar-trigger md:hidden"
          title="Toggle sidebar"
        />
        <SidebarAwareNetworkMap
          onConnectProgram={connectFromMap}
          onConnectPartner={connectPartnerFromMap}
          onSelectItem={selectFromMap}
          onPointClick={() => setRecentConnections([])}
          onClearSelection={clearMapSelection}
          locations={locations}
          programConnections={programConnections}
          selectedProgramId={selectedProgramId}
          showAllConnections={selectedProgramId === SHOW_ALL_CONNECTIONS}
          selectedPartnerName={selectedPartnerName}
          selectionRevision={selectionRevision}
          showZoomControls={showZoomControls}
          showMapLegend={showMapLegend}
          clusterMarkers={clusterMarkers}
          showRegionLabels={showRegionLabels}
          showCityLabels={showCityLabels}
          recentConnections={recentConnections}
          popupDismissRevision={popupDismissRevision}
          activeTourRegion={activeTourRegion}
          tourExitRevision={tourExitRevision}
          onTourStatus={onTourStatus}
          onManualInteraction={interruptTour}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
