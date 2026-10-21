"use client"

import dynamic from "next/dynamic"

import type {
  NystarLocationGroup,
  NystarProgramConnection,
} from "@/lib/nystar-locations"
import type { RecentConnection } from "@/lib/recent-connection"

import type { MapItemSelection } from "./nystar-leaflet-map"

const LeafletMap = dynamic(() => import("./nystar-leaflet-map"), {
  ssr: false,
  loading: () => <div className="network-map-loading" aria-hidden="true" />,
})

export default function NystarNetworkMap({
  locations,
  programConnections,
  selectedProgramId,
  showAllConnections,
  selectedPartnerName,
  selectionRevision,
  showZoomControls,
  showMapLegend,
  clusterMarkers,
  showRegionLabels,
  showCityLabels,
  recentConnections,
  popupDismissRevision,
  onConnectProgram,
  onConnectPartner,
  onSelectItem,
  activeTourRegion,
  tourExitRevision,
  onTourStatus,
  onManualInteraction,
}: {
  locations: NystarLocationGroup[]
  programConnections: NystarProgramConnection[]
  selectedProgramId: string
  showAllConnections: boolean
  selectedPartnerName: string
  selectionRevision: number
  showZoomControls: boolean
  showMapLegend: boolean
  clusterMarkers: boolean
  showRegionLabels: boolean
  showCityLabels: boolean
  recentConnections: RecentConnection[]
  popupDismissRevision: number
  onConnectProgram?: (programId: string) => void
  onConnectPartner?: (partnerName: string) => void
  onSelectItem?: (item: MapItemSelection) => void
  activeTourRegion: string | null
  tourExitRevision: number
  onTourStatus: (revision: number, error: string | null) => void
  onManualInteraction: () => void
}) {
  return (
    <LeafletMap
      locations={locations}
      programConnections={programConnections}
      selectedProgramId={selectedProgramId}
      showAllConnections={showAllConnections}
      selectedPartnerName={selectedPartnerName}
      selectionRevision={selectionRevision}
      showZoomControls={showZoomControls}
      showMapLegend={showMapLegend}
      clusterMarkers={clusterMarkers}
      showRegionLabels={showRegionLabels}
      showCityLabels={showCityLabels}
      recentConnections={recentConnections}
      popupDismissRevision={popupDismissRevision}
      onConnectProgram={onConnectProgram}
      onConnectPartner={onConnectPartner}
      onSelectItem={onSelectItem}
      activeTourRegion={activeTourRegion}
      tourExitRevision={tourExitRevision}
      onTourStatus={onTourStatus}
      onManualInteraction={onManualInteraction}
    />
  )
}
