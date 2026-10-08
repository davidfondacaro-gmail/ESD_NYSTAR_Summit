"use client"

import dynamic from "next/dynamic"

import type { NystarLocationGroup } from "@/lib/nystar-locations"

const LeafletMap = dynamic(() => import("./nystar-leaflet-map"), {
  ssr: false,
  loading: () => <div className="network-map-loading" aria-hidden="true" />,
})

export default function NystarNetworkMap({
  locations,
}: {
  locations: NystarLocationGroup[]
}) {
  return <LeafletMap locations={locations} />
}
