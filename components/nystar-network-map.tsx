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
  showZoomControls,
}: {
  locations: NystarLocationGroup[]
  selectedProgramId: string
  selectedPartnerName: string
  showZoomControls: boolean
}) {
  return (
    <LeafletMap
      locations={locations}
      selectedProgramId={selectedProgramId}
      selectedPartnerName={selectedPartnerName}
      showZoomControls={showZoomControls}
    />
  )
}
