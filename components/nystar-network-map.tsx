"use client"

import dynamic from "next/dynamic"

import type { NystarLocationGroup } from "@/lib/nystar-locations"
import type { RecentConnection } from "@/lib/recent-connection"

const LeafletMap = dynamic(() => import("./nystar-leaflet-map"), {
  ssr: false,
  loading: () => <div className="network-map-loading" aria-hidden="true" />,
})

export default function NystarNetworkMap({
  locations,
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
}: {
  locations: NystarLocationGroup[]
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
}) {
  return (
    <LeafletMap
      locations={locations}
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
  )
}
