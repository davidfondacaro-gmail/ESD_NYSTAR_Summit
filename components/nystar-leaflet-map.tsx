"use client"

import L from "leaflet"
import { useEffect, useMemo, useRef, type RefObject } from "react"
import { useTheme } from "next-themes"
import {
  MapContainer,
  Marker,
  Pane,
  Popup,
  ZoomControl,
  useMap,
} from "react-leaflet"

import { useSidebar } from "@/components/ui/sidebar"
import type { NystarLocationGroup } from "@/lib/nystar-locations"

const DEFAULT_MAP_CENTER: L.LatLngExpression = [42.7462, -75.7154]
const CATEGORY_COLORS: Record<string, string> = {
  "Centers for Advanced Technology": "#72a7c0",
  "Centers for Advanced Technology--NO LONGER OPERATING": "#c7b85d",
  "Centers of Excellence": "#c58b32",
  "Innovation Hot Spot": "#4e927a",
  "New York Manufacturing Extension Partnership": "#4786a4",
  "New York State Accelerators and Competition": "#ba7050",
  "New York State Accelerators and Competitions": "#ad839a",
  "NY Fashion Innovation Center": "#a97fb2",
  "NY Global Entrepreneurs Program": "#4f9697",
  "NYS-Certified Business Incubator": "#a4934f",
}

const REGION_LABEL_OFFSETS: Record<string, [number, number]> = {
  "Mohawk Valley": [36, 24],
  "North Country": [0, -15],
  "Western New York": [0, 48],
  "New York City": [-100, -60],
  "Long Island": [100, -80],
  "Hudson Valley": [0, -60],
  "Central New York": [0, 55],
}

const REGION_LABEL_CALLOUTS = new Set(["New York City", "Long Island"])
const REGION_LABEL_CALLOUT_LEFT = new Set(["Long Island"])

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

function MapZoomControls({ enabled }: { enabled: boolean }) {
  const map = useMap()

  useEffect(() => {
    if (enabled) {
      map.setMinZoom(5)
      map.setMaxZoom(12)
      map.dragging.enable()
      return
    }

    map.dragging.disable()
    map.setMinZoom(7)
    map.setMaxZoom(7)
    map.setView(DEFAULT_MAP_CENTER, 7, { animate: false })
  }, [enabled, map])

  return enabled ? <ZoomControl position="bottomright" /> : null
}

function MepRegionsLayer() {
  const map = useMap()
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const controller = new AbortController()
    let regionsLayer: L.GeoJSON | null = null
    let regionLabelsLayer: L.LayerGroup | null = null

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

        const regionLabelsPane =
          map.getPane("region-labels") ?? map.createPane("region-labels")
        regionLabelsPane.style.zIndex = "590"
        regionLabelsPane.style.pointerEvents = "none"
        const labelsLayer = L.layerGroup()

        regionsLayer = L.geoJSON(geoJson, {
          interactive: false,
          style: {
            color: getComputedStyle(document.documentElement)
              .getPropertyValue("--network-region-outline")
              .trim(),
            weight: 1.25,
            opacity: 0.9,
            fillColor: getComputedStyle(document.documentElement)
              .getPropertyValue("--network-region-fill")
              .trim(),
            fillOpacity: 0.98,
          },
          onEachFeature(feature, layer) {
            const regionName =
              typeof feature.properties?.region_name === "string"
                ? feature.properties.region_name.trim()
                : ""
            if (!regionName || !(layer instanceof L.Polygon)) {
              return
            }

            const [offsetX, offsetY] = REGION_LABEL_OFFSETS[regionName] ?? [0, 0]
            const calloutClass = REGION_LABEL_CALLOUTS.has(regionName)
              ? ` nystar-region-label__text--callout${REGION_LABEL_CALLOUT_LEFT.has(regionName) ? " nystar-region-label__text--callout-left" : ""}`
              : ""
            L.marker(layer.getBounds().getCenter(), {
              pane: "region-labels",
              interactive: false,
              keyboard: false,
              icon: L.divIcon({
                className: "nystar-region-label",
                html: `<span class="nystar-region-label__text${calloutClass}" style="--region-label-x:${offsetX}px;--region-label-y:${offsetY}px">${regionName}</span>`,
                iconSize: [0, 0],
                iconAnchor: [0, 0],
              }),
            }).addTo(labelsLayer)
          },
        }).addTo(map)
        regionLabelsLayer = labelsLayer.addTo(map)
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
      regionLabelsLayer?.remove()
    }
  }, [map, resolvedTheme])

  return null
}

function locationKey(location: NystarLocationGroup) {
  return `${location.latitude}-${location.longitude}`
}

function OpenSelectedMapSelectionPopup({
  locations,
  markerRefs,
  selectedProgramId,
  selectedPartnerName,
}: {
  locations: NystarLocationGroup[]
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

    markerRefs.current.get(locationKey(matchingLocation))?.openPopup()
  }, [locations, map, markerRefs, selectedPartnerName, selectedProgramId])

  return null
}

function markerIcon(categories: string[], hasInnovationPartner: boolean) {
  const markerCategories = [...new Set(categories)]
  const stars = markerCategories
    .map((category) => {
      const color = CATEGORY_COLORS[category] ?? "var(--network-customer-marker)"
      return `<span class="nystar-marker__star" style="--marker-color:${color}"></span>`
    })
    .join("")
  const single = markerCategories.length === 1
  const customerDot = hasInnovationPartner
    ? `<span class="nystar-marker__partner-dot${markerCategories.length === 0 ? " nystar-marker__partner-dot--single" : ""}"></span>`
    : ""
  const starsClass = [
    "nystar-marker__stars",
    single ? "nystar-marker__stars--single" : "",
    hasInnovationPartner && markerCategories.length > 0
      ? "nystar-marker__stars--with-partner"
      : "",
  ]
    .filter(Boolean)
    .join(" ")
  const starContent = stars ? `<span class="${starsClass}">${stars}</span>` : ""

  return L.divIcon({
    className: "nystar-marker",
    html: `<span class="nystar-marker__symbols">${starContent}${customerDot}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  })
}

export default function NystarLeafletMap({
  locations,
  selectedProgramId,
  selectedPartnerName,
  showZoomControls,
  showMapLegend,
}: {
  locations: NystarLocationGroup[]
  selectedProgramId: string
  selectedPartnerName: string
  showZoomControls: boolean
  showMapLegend: boolean
}) {
  const markerRefs = useRef(new Map<string, L.Marker>())
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
  const mapCategories = Array.from(
    new Set(locations.flatMap((location) => location.assets.map((asset) => asset.category)))
  ).sort((left, right) => left.localeCompare(right))
  return (
    <div className="network-map-shell">
      <MapContainer
      className="network-map-canvas"
      center={DEFAULT_MAP_CENTER}
      zoom={7}
      minZoom={5}
      maxZoom={12}
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
      <MapZoomControls enabled={showZoomControls} />
      <RecenterMapOnSidebarClose />
      <MepRegionsLayer />
      <OpenSelectedMapSelectionPopup
        locations={locations}
        markerRefs={markerRefs}
        selectedProgramId={selectedProgramId}
        selectedPartnerName={selectedPartnerName}
      />
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
              location.assets.map((asset) => asset.category),
              location.customers.length > 0
            )}
          >
            <Popup autoPan={false}>
              <div className="network-popup">
                {location.assets.length === 0 && (
                  <p className="network-popup__place">
                    {location.cities.join(" / ")}, NY · ZIP{" "}
                    {location.zipCodes.join(", ")} · Approximate ZIP center
                  </p>
                )}
                <ul className="network-popup__assets">
                  {location.assets.map((asset) => (
                    <li
                      className="network-popup__asset"
                      key={`${asset.name}-${asset.hostOrganization}`}
                    >
                      <strong className="network-popup__name">
                        {asset.name}
                      </strong>
                      <div className="network-popup__category-row">
                        <span
                          className="network-popup__diamond"
                          style={{
                            "--marker-color":
                              CATEGORY_COLORS[asset.category] ??
                              "var(--network-customer-marker)",
                          } as React.CSSProperties}
                          aria-hidden="true"
                        />
                        <span className="network-popup__primary">
                          {asset.category}
                        </span>
                      </div>
                      {asset.hostOrganization && (
                        <span className="network-popup__category">
                          {asset.hostOrganization}
                        </span>
                      )}
                      <span className="network-popup__category">
                        {[
                          asset.addressLine1,
                          asset.addressLine2,
                          [asset.city, asset.state, asset.zipCode]
                            .filter(Boolean)
                            .join(", "),
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </li>
                  ))}
                  {location.customers.map((customer) => (
                    <li
                      className="network-popup__customer"
                      key={customer.id}
                    >
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
        {showMapLegend && (
          <aside className="network-map-legend" aria-label="Map legend">
            <h2 className="network-map-legend__title">NYSTAR Programs</h2>
            <ul className="network-map-legend__items">
              {mapCategories.map((category) => (
                <li className="network-map-legend__item" key={category}>
                  <span
                    className="network-map-legend__star"
                    style={{
                      "--marker-color": CATEGORY_COLORS[category] ?? "var(--network-customer-marker)",
                    } as React.CSSProperties}
                    aria-hidden="true"
                  />
                  <span>{category}</span>
                </li>
              ))}
            </ul>
            <h2 className="network-map-legend__title network-map-legend__title--section">
              Innovation Partners
            </h2>
            <ul className="network-map-legend__items">
              <li className="network-map-legend__item">
                <span
                  className="network-map-legend__dot"
                  aria-hidden="true"
                />
                <span>Customer organization</span>
              </li>
            </ul>
            <h2 className="network-map-legend__title network-map-legend__title--section">
              NYSTAR-Partner Connections
            </h2>
            <ul className="network-map-legend__items">
              <li className="network-map-legend__item">
                <span
                  className="network-map-legend__line"
                  aria-hidden="true"
                />
                <span>Current/Past Connections</span>
              </li>
              <li className="network-map-legend__item">
                <span
                  className="network-map-legend__line network-map-legend__line--dashed"
                  aria-hidden="true"
                />
                <span>Emerging/Desired Connections</span>
              </li>
            </ul>
          </aside>
        )}
    </div>
  )
}
