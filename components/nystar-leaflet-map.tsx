"use client"

import L from "leaflet"
import { useEffect, useMemo, useRef, type RefObject } from "react"
import MarkerClusterGroup from "react-leaflet-cluster"
import { MapContainer, Marker, Pane, Popup, useMap } from "react-leaflet"

import { useSidebar } from "@/components/ui/sidebar"
import type { NystarLocationGroup } from "@/lib/nystar-locations"

type ClusterVisibleMarker = L.Marker & { spiderfy?: () => void }

type MarkerClusterGroupApi = {
  getVisibleParent: (marker: L.Marker) => ClusterVisibleMarker | null
  once: (event: "spiderfied", callback: () => void) => unknown
}

const DEFAULT_MAP_CENTER: L.LatLngExpression = [42.7462, -75.7154]

const cityLabels = [
  {
    name: "Albany",
    position: [42.6526, -73.7562] as L.LatLngExpression,
    offset: [-42, 17],
  },
  {
    name: "Utica",
    position: [43.1009, -75.2327] as L.LatLngExpression,
    offset: [18, -32],
  },
  {
    name: "Rochester",
    position: [43.1566, -77.6088] as L.LatLngExpression,
    offset: [8, -40],
  },
  {
    name: "Buffalo",
    position: [42.8864, -78.8784] as L.LatLngExpression,
    offset: [-34, 24],
  },
  {
    name: "Binghamton",
    position: [42.0987, -75.918] as L.LatLngExpression,
    offset: [8, 14],
  },
  {
    name: "Syracuse",
    position: [43.0481, -76.1474] as L.LatLngExpression,
    offset: [73, 8],
  },
  {
    name: "Plattsburgh",
    position: [44.6995, -73.4529] as L.LatLngExpression,
    offset: [20, 1],
  },
  {
    name: "Watertown",
    position: [43.9748, -75.9108] as L.LatLngExpression,
    offset: [-52, -16],
  },
  {
    name: "Woodstock",
    position: [42.0409, -74.1182] as L.LatLngExpression,
    offset: [34, 15],
  },
  {
    name: "New York City",
    position: [40.7128, -74.006] as L.LatLngExpression,
    offset: [-86, 14],
  },
] as const

function InvalidateMapSize() {
  const map = useMap()

  useEffect(() => {
    let resizeTimeout: number | undefined
    const observer = new ResizeObserver(() => {
      if (resizeTimeout) {
        window.clearTimeout(resizeTimeout)
      }
      resizeTimeout = window.setTimeout(
        () => map.invalidateSize({ pan: true, animate: false }),
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

function RecenterMapOnSidebarClose() {
  const map = useMap()
  const { isMobile, state } = useSidebar()

  useEffect(() => {
    if (isMobile || state !== "collapsed") {
      return
    }

    const recenterTimeout = window.setTimeout(() => {
      const zoom = map.getZoom()
      map.invalidateSize({ pan: false })
      map.setView(DEFAULT_MAP_CENTER, zoom, { animate: false })
    }, 250)

    return () => window.clearTimeout(recenterTimeout)
  }, [isMobile, map, state])

  return null
}

function MepRegionsLayer() {
  const map = useMap()

  useEffect(() => {
    const controller = new AbortController()
    let regionsLayer: L.GeoJSON | null = null

    async function loadRegions() {
      try {
        const response = await fetch("/data/ny_mep_regions.geojson", {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error("Unable to load NY MEP regions.")
        }

        const geoJson = (await response.json()) as GeoJSON.GeoJsonObject
        if (controller.signal.aborted) {
          return
        }

        regionsLayer = L.geoJSON(geoJson, {
          interactive: false,
          style: {
            color: "#35546b",
            weight: 1.25,
            opacity: 0.9,
            fillColor: "#142b3b",
            fillOpacity: 0.98,
          },
        }).addTo(map)
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Failed to load NY MEP regions.", error)
        }
      }
    }

    void loadRegions()

    return () => {
      controller.abort()
      regionsLayer?.remove()
    }
  }, [map])

  return null
}

function locationKey(location: NystarLocationGroup) {
  return `${location.latitude}-${location.longitude}`
}

function OpenSelectedMapSelectionPopup({
  locations,
  clusterGroupRef,
  markerRefs,
  selectedProgramId,
  selectedPartnerName,
}: {
  locations: NystarLocationGroup[]
  clusterGroupRef: RefObject<MarkerClusterGroupApi | null>
  markerRefs: RefObject<Map<string, L.Marker>>
  selectedProgramId: string
  selectedPartnerName: string
}) {
  const map = useMap()

  useEffect(() => {
    if (!selectedProgramId && !selectedPartnerName) {
      return
    }

    map.closePopup()
    const matchingLocation = locations.find((location) =>
      selectedProgramId
        ? location.assets.some((asset) => asset.id === selectedProgramId)
        : location.assets.some(
            (asset) => asset.hostOrganization === selectedPartnerName
          ) ||
          location.customers.some(
            (customer) => customer.name === selectedPartnerName
          )
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
  }, [
    clusterGroupRef,
    locations,
    map,
    markerRefs,
    selectedPartnerName,
    selectedProgramId,
  ])

  return null
}

function markerIcon(count: number) {
  const isGroup = count > 1
  const label = isGroup
    ? `<span class="nystar-marker__count">${count}</span>`
    : ""

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
      center={DEFAULT_MAP_CENTER}
      zoom={7}
      minZoom={7}
      maxZoom={7}
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      attributionControl={false}
    >
      <InvalidateMapSize />
      <RecenterMapOnSidebarClose />
      <MepRegionsLayer />
      <OpenSelectedMapSelectionPopup
        locations={locations}
        clusterGroupRef={clusterGroupRef}
        markerRefs={markerRefs}
        selectedProgramId={selectedProgramId}
        selectedPartnerName={selectedPartnerName}
      />
      <MarkerClusterGroup
        ref={(clusterGroup: unknown) => {
          clusterGroupRef.current = clusterGroup as unknown as MarkerClusterGroupApi | null
        }}
        chunkedLoading
        showCoverageOnHover={false}
        maxClusterRadius={36}
        zoomToBoundsOnClick={false}
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
      <Pane
        name="city-labels"
        style={{ zIndex: 650, pointerEvents: "none" }}
      >
        {cityLabels.map(({ name, position, offset }) => (
          <Marker
            key={name}
            position={position}
            icon={L.divIcon({
              className: "nystar-city-label",
              html: `<span class="nystar-city-label__text" style="--city-label-x:${offset[0]}px;--city-label-y:${offset[1]}px">${name}</span>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            })}
            interactive={false}
            keyboard={false}
          />
        ))}
      </Pane>
    </MapContainer>
  )
}
