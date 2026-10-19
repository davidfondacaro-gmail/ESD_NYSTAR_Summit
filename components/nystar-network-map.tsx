"use client"

import dynamic from "next/dynamic"

import type { NystarLocationGroup } from "@/lib/nystar-locations"

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
  showRegionLabels,
  showCityLabels,
}: {
  locations: NystarLocationGroup[]
  selectedProgramId: string
  selectedPartnerName: string
  selectionRevision: number
  showZoomControls: boolean
  showMapLegend: boolean
  showRegionLabels: boolean
  showCityLabels: boolean
}) {
  return (
    <LeafletMap
      locations={locations}
      selectedProgramId={selectedProgramId}
      selectedPartnerName={selectedPartnerName}
      selectionRevision={selectionRevision}
      showZoomControls={showZoomControls}
      showMapLegend={showMapLegend}
      showRegionLabels={showRegionLabels}
      showCityLabels={showCityLabels}
    />
  )
}
