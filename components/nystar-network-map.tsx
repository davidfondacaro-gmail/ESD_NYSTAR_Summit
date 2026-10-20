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
  onSelectItem,
}: {
  locations: NystarLocationGroup[]
  programConnections: NystarProgramConnection[]
  selectedProgramId: string
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
  onSelectItem?: (item: MapItemSelection) => void
}) {
  return (
    <LeafletMap
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
      onConnectProgram={onConnectProgram}
      onSelectItem={onSelectItem}
    />
  )
}
