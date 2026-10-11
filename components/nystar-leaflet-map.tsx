"use client"

import L from "leaflet"
import { useEffect, useMemo, useRef, type RefObject } from "react"
import MarkerClusterGroup from "react-leaflet-cluster"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"

import type { NystarLocationGroup } from "@/lib/nystar-locations"

type ClusterVisibleMarker = L.Marker & { spiderfy?: () => void }

type MarkerClusterGroupApi = {
  getVisibleParent: (marker: L.Marker) => ClusterVisibleMarker | null
  once: (event: "spiderfied", callback: () => void) => unknown
}

function FitLocations({ locations }: { locations: NystarLocationGroup[] }) {
  const map = useMap()

  useEffect(() => {
    const bounds = L.latLngBounds(
      locations.map(({ latitude, longitude }) => L.latLng(latitude, longitude))
    )

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 9 })
    }
  }, [locations, map])

  return null
}

function InvalidateMapSize() {
  const map = useMap()

  useEffect(() => {
    let resizeTimeout: number | undefined
    const observer = new ResizeObserver(() => {
      if (resizeTimeout) {
        window.clearTimeout(resizeTimeout)
      }
      resizeTimeout = window.setTimeout(
        () => map.invalidateSize({ pan: false }),
        100
      )
    })

    observer.observe(map.getContainer())

    return () => {
      if (resizeTimeout) {
        window.clearTimeout(resizeTimeout)
      }
      observer.disconnect()
    }
  }, [map])

  return null
}

function locationKey(location: NystarLocationGroup) {
  return `${location.latitude}-${location.longitude}`
}

function OpenSelectedProgramPopup({
  locations,
  clusterGroupRef,
  markerRefs,
  selectedProgramId,
}: {
  locations: NystarLocationGroup[]
  clusterGroupRef: RefObject<MarkerClusterGroupApi | null>
  markerRefs: RefObject<Map<string, L.Marker>>
  selectedProgramId: string
}) {
  const map = useMap()

  useEffect(() => {
    if (!selectedProgramId) {
      return
    }

    map.closePopup()
    const matchingLocation = locations.find((location) =>
      location.assets.some((asset) => asset.id === selectedProgramId)
    )
    if (!matchingLocation) {
      return
    }

    const marker = markerRefs.current.get(locationKey(matchingLocation))
    const clusterGroup = clusterGroupRef.current
    if (!marker || !clusterGroup) {
      return
    }

    const visibleParent = clusterGroup.getVisibleParent(marker)
    if (
      visibleParent &&
      visibleParent !== marker &&
      typeof visibleParent.spiderfy === "function"
    ) {
      clusterGroup.once("spiderfied", () => marker.openPopup())
      visibleParent.spiderfy()
      return
    }

    marker.openPopup()
  }, [clusterGroupRef, locations, map, markerRefs, selectedProgramId])

  return null
}

function FocusNetworkSelection({
  locations,
  selectedPartnerName,
}: {
  locations: NystarLocationGroup[]
  selectedPartnerName: string
}) {
  const map = useMap()

  useEffect(() => {
    if (!selectedPartnerName) {
      return
    }

    const matchingLocations = locations.filter((location) =>
      location.assets.some(
        (asset) => asset.hostOrganization === selectedPartnerName
      ) ||
      location.customers.some(
        (customer) => customer.name === selectedPartnerName
      )
    )

    if (matchingLocations.length === 1) {
      const [location] = matchingLocations
      map.flyTo(
        [location.latitude, location.longitude],
        Math.max(map.getZoom(), 10),
        { duration: 0.6 }
      )
    } else if (matchingLocations.length > 1) {
      map.fitBounds(
        L.latLngBounds(
          matchingLocations.map((location) =>
            L.latLng(location.latitude, location.longitude)
          )
        ),
        { padding: [48, 48], maxZoom: 9 }
      )
    }
  }, [locations, map, selectedPartnerName])

  return null
}

function markerIcon(count: number) {
  const isGroup = count > 1
  const label = isGroup ? String(count) : ""

  return L.divIcon({
    className: "nystar-marker",
    html: `<span class="nystar-marker__dot${isGroup ? " nystar-marker__dot--group" : ""}">${label}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -13],
  })
}

export default function NystarLeafletMap({
  locations,
  selectedProgramId,
  selectedPartnerName,
}: {
  locations: NystarLocationGroup[]
  selectedProgramId: string
  selectedPartnerName: string
}) {
  const markerRefs = useRef(new Map<string, L.Marker>())
  const clusterGroupRef = useRef<MarkerClusterGroupApi | null>(null)
  const markerPositions = useMemo(() => {
    const positions = new Map<string, L.LatLng>()
    for (const location of locations) {
      positions.set(
        locationKey(location),
        L.latLng(location.latitude, location.longitude)
      )
    }
    return positions
  }, [locations])

  return (
    <MapContainer
      className="network-map-canvas"
      center={[42.95, -75.5]}
      zoom={7}
      minZoom={5}
      zoomSnap={0.5}
      scrollWheelZoom
    >
      <InvalidateMapSize />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitLocations locations={locations} />
      <OpenSelectedProgramPopup
        locations={locations}
        clusterGroupRef={clusterGroupRef}
        markerRefs={markerRefs}
        selectedProgramId={selectedProgramId}
      />
      <FocusNetworkSelection
        locations={locations}
        selectedPartnerName={selectedPartnerName}
      />
      <MarkerClusterGroup
        ref={(clusterGroup: unknown) => {
          clusterGroupRef.current = clusterGroup as unknown as MarkerClusterGroupApi | null
        }}
        chunkedLoading
        showCoverageOnHover={false}
        maxClusterRadius={36}
      >
        {locations.map((location) => (
          <Marker
            key={`${location.latitude}-${location.longitude}`}
            ref={(marker) => {
              const key = locationKey(location)
              if (marker) markerRefs.current.set(key, marker)
              else markerRefs.current.delete(key)
            }}
            position={markerPositions.get(locationKey(location))!}
            icon={markerIcon(
              location.assets.length + location.customers.length
            )}
            title={`${location.assets.length + location.customers.length} network ${location.assets.length + location.customers.length === 1 ? "location" : "locations"} near ${location.cities.join(", ")}`}
          >
            <Popup autoPan={false}>
              <div className="network-popup">
                <p className="network-popup__place">
                  {location.cities.join(" / ")}, NY · ZIP{" "}
                  {location.zipCodes.join(", ")} · Approximate ZIP center
                </p>
                <ul className="network-popup__assets">
                  {location.assets.map((asset) => (
                    <li key={`${asset.name}-${asset.hostOrganization}`}>
                      <span className="network-popup__category">
                        {asset.category}
                      </span>
                      <strong className="network-popup__name">
                        {asset.name}
                      </strong>
                      <span className="network-popup__host">
                        {asset.hostOrganization}
                      </span>
                    </li>
                  ))}
                  {location.customers.map((customer) => (
                    <li key={customer.id}>
                      <span className="network-popup__category">
                        Customer organization
                      </span>
                      <strong className="network-popup__name">
                        {customer.name}
                      </strong>
                      <span className="network-popup__host">
                        {[customer.addressLine1, customer.addressLine2]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                      {customer.connections.map((connection) => (
                        <span
                          className="network-popup__host"
                          key={connection.id}
                        >
                          {connection.connectionType}: {connection.assetName}
                          {connection.hostOrganization &&
                            ` · ${connection.hostOrganization}`}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  )
}
