"use client"

import L from "leaflet"
import Image from "next/image"
import { arrow, computePosition, offset, platform, shift, type Placement } from "@floating-ui/dom"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react"
import { createPortal } from "react-dom"
import MarkerClusterGroup from "react-leaflet-cluster"
import {
  MapContainer,
  Marker,
  Pane,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet"

import { useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Link, Pentagon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CATEGORY_COLORS } from "@/lib/nystar-category-colors"
import type {
  NystarLocationGroup,
  NystarProgramConnection,
} from "@/lib/nystar-locations"
import type { RecentConnection } from "@/lib/recent-connection"
import { coveredConnectionLength, overlapArea } from "@/lib/map-popup-placement"
import { connectedOrganizationsForPopup, connectionKey, connectionsForPopup, tourInsetData } from "@/lib/network-connections"
import { CUSTOMER_LEGEND_FILTER, filterLegendLocations } from "@/lib/network-legend"
import { calloutAnchor, layoutPointLabels, type Box, type PlacedLabel } from "@/lib/map-point-labels"

const DEFAULT_MAP_CENTER: L.LatLngExpression = [42.7462, -75.7154]
const DEFAULT_MAP_ZOOM = 7.5
const STATEWIDE_BOUNDS = L.latLngBounds([40.49, -79.77], [45.02, -71.85])

function resetStatewideView(map: L.Map) {
  const zoom = Math.min(
    DEFAULT_MAP_ZOOM,
    map.getBoundsZoom(STATEWIDE_BOUNDS, false, L.point(40, 40))
  )
  map.setView(DEFAULT_MAP_CENTER, zoom, { animate: false })
}

const markerItemCounts = new WeakMap<L.Marker, number>()
const connectionSegments = new WeakMap<L.Map, Map<L.Polyline, { from: L.LatLng; to: L.LatLng }>>()
const CONNECTION_GEOMETRY_EVENT = "connectiongeometrychange"

export type MapItemSelection =
  | { kind: "program"; id: string }
  | { kind: "partner"; name: string }

type MapPopupRequest = {
  locationKey: string
  selectionRevision: number
}

function numberedMarkerIcon(count: number, selected = false) {
  return L.divIcon({
    className: selected
      ? "nystar-cluster-marker nystar-marker--selected"
      : "nystar-cluster-marker",
    html: `<span class="nystar-cluster-marker__count" aria-label="${count} network items">${count}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  })
}

function clusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getAllChildMarkers().reduce(
    (total, marker) => total + (markerItemCounts.get(marker) ?? 1),
    0
  )
  const selected = cluster.getAllChildMarkers().some((marker) =>
    marker.options.icon?.options.className?.includes("nystar-marker--selected")
  )
  return numberedMarkerIcon(count, selected)
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
    offset: [-120, 1],
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

function RecenterMapOnSidebarClose({ touring }: { touring: boolean }) {
  const map = useMap()
  const { isMobile, state } = useSidebar()

  useEffect(() => {
    if (touring || isMobile || state !== "collapsed") {
      return
    }

    const recenterTimeout = window.setTimeout(() => {
      const zoom = map.getZoom()
      map.invalidateSize({ pan: false })
      map.setView(DEFAULT_MAP_CENTER, zoom, { animate: false })
    }, 250)

    return () => window.clearTimeout(recenterTimeout)
  }, [isMobile, map, state, touring])

  return null
}

// Outline of New York State generated from the MEP region boundaries (24×24 viewBox).
const NY_STATE_ICON_PATH = "M16.3 11.8 16.3 12.2 16.6 12.1 16.3 13.5 15.8 13.5 15.0 12.9 13.1 13.7 13.6 11.6 13.0 11.6 12.2 10.5 11.8 10.5 11.8 9.8 12.0 9.2 12.8 9.5 13.9 8.7 13.8 6.9 14.7 7.0 14.9 9.2 14.6 9.8 15.5 10.2 16.6 10.1 16.8 11.5ZM10.8 13.3 11.8 13.3 11.8 12.1 13.4 12.0 13.1 13.7 15.1 12.9 15.8 13.5 15.5 14.1 15.8 14.2 13.8 15.4 13.3 14.9 6.6 14.9 6.8 12.7 8.3 12.7 8.3 13.0 8.8 13.1 9.0 12.8 9.8 12.8 9.6 12.5 10.7 12.5ZM18.8 12.9 18.3 14.9 17.2 14.6 17.0 14.2 16.8 14.5 15.5 14.1 15.8 13.5 16.4 13.4 16.6 12.1 16.2 12.0 16.8 11.5 16.4 8.3 18.8 8.1 18.5 9.0 18.9 8.7 19.1 9.0ZM11.5 6.1 13.4 4.1 14.6 3.5 18.8 3.4 18.8 4.6 18.6 4.6 18.9 6.2 18.5 7.1 18.7 8.0 16.4 8.3 16.6 10.1 16.4 10.2 15.5 10.2 14.6 9.8 14.9 9.2 14.7 7.0 13.8 6.9 13.9 8.7 12.8 9.5 12.1 9.3 12.1 8.4 10.9 8.5 10.6 7.8 10.9 7.6 10.9 7.8 11.3 7.3 10.9 7.4 11.2 7.1 10.9 7.0 10.7 7.4 10.4 6.9ZM2.9 14.9 1.0 14.9 1.0 13.8 2.7 12.8 3.5 11.9 3.4 10.9 2.9 10.7 2.9 10.1 4.6 9.7 4.6 12.9 6.7 13.1 6.6 14.9ZM16.8 20.0 16.3 20.6 16.5 20.0ZM17.0 19.9 17.3 19.5 17.9 19.6 17.8 20.0 17.3 20.1 17.4 20.3 17.0 20.3ZM17.2 19.4 17.3 19.0 17.6 19.1 17.6 19.4ZM18.4 19.0 18.5 19.2 18.5 18.9 18.6 19.1 18.7 18.8 19.3 19.1 19.5 18.7 21.1 18.7 21.8 18.1 20.9 19.0 21.4 19.0 21.7 18.5 21.7 18.7 22.2 18.5 22.3 18.7 23.0 18.4 21.3 19.3 21.5 19.1 21.2 19.1 20.2 19.7 19.4 19.6 17.9 20.2 17.7 20.1 17.7 19.3 18.0 19.4 18.1 19.0ZM17.3 18.7 15.0 17.0 14.3 16.8 13.8 15.4 15.8 14.2 16.8 14.5 17.0 14.2 17.2 14.6 18.3 14.9 18.5 14.7 18.3 17.5 18.5 17.9 17.8 18.3 18.0 18.7 17.7 19.1 17.3 19.0ZM5.7 12.9 4.6 12.9 4.6 9.7 6.6 9.8 7.2 10.2 9.5 9.8 9.4 12.1 9.8 12.8 9.0 12.8 8.8 13.1 8.3 13.0 8.3 12.7 6.8 12.7 6.7 13.1ZM11.8 12.2 11.8 13.3 10.8 13.3 10.7 12.5 9.6 12.5 9.4 12.0 9.5 9.8 10.3 9.1 10.8 9.0 10.9 8.5 11.4 8.4 12.1 8.4 11.8 10.5 12.2 10.5 12.7 11.3 13.6 11.7 13.4 12.0Z"

function NyStateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nystar-map-toolbar__icon">
      <path d={NY_STATE_ICON_PATH} fill="currentColor" stroke="currentColor"
        strokeWidth={0.5} strokeLinejoin="round" />
    </svg>
  )
}

function MapToolbar({ regions, activeRegion, onSelectRegion, onStatewide }: {
  regions: string[]
  activeRegion: string | null
  onSelectRegion: (region: string) => void
  onStatewide: () => void
}) {
  const map = useMap()
  const [element] = useState(() => {
    const container = L.DomUtil.create("div", "leaflet-bar nystar-map-toolbar")
    L.DomEvent.disableClickPropagation(container)
    L.DomEvent.disableScrollPropagation(container)
    return container
  })
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })

  useEffect(() => {
    const control = new L.Control({ position: "bottomright" })
    control.onAdd = () => element
    control.addTo(map)
    return () => {
      control.remove()
    }
  }, [element, map])

  return createPortal(
    <>
      <Tooltip>
      <TooltipTrigger render={<button type="button" />} className="nystar-map-toolbar__button leaflet-control-zoom-in"
        aria-label="Zoom in" disabled={zoom >= map.getMaxZoom()}
        onClick={() => map.zoomIn()}>
        <span aria-hidden="true">+</span>
      </TooltipTrigger>
      <TooltipContent side="left">Zoom in</TooltipContent>
      </Tooltip>
      <Tooltip>
      <TooltipTrigger render={<button type="button" />} className="nystar-map-toolbar__button leaflet-control-zoom-out"
        aria-label="Zoom out" disabled={zoom <= map.getMinZoom()}
        onClick={() => map.zoomOut()}>
        <span aria-hidden="true">&#x2212;</span>
      </TooltipTrigger>
      <TooltipContent side="left">Zoom out</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <Tooltip>
        <DropdownMenuTrigger
          render={<TooltipTrigger render={<button type="button" />} className="nystar-map-toolbar__button" />}
          aria-label="Zoom to region" disabled={regions.length === 0}
        >
          <Pentagon aria-hidden="true" className="nystar-map-toolbar__icon" />
        </DropdownMenuTrigger>
        <TooltipContent side="left">Zoom to region</TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="left" align="end" sideOffset={8} className="w-auto min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Zoom to region</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={activeRegion ?? ""} onValueChange={onSelectRegion}>
              {regions.map((region) => (
                <DropdownMenuRadioItem key={region} value={region} closeOnClick>
                  {region}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
      <TooltipTrigger render={<button type="button" />} className="nystar-map-toolbar__button"
        aria-label="Statewide view" onClick={onStatewide}>
        <NyStateIcon />
      </TooltipTrigger>
      <TooltipContent side="left">Statewide view</TooltipContent>
      </Tooltip>
    </>,
    element
  )
}

function MapZoomControls({ enabled, touring, regions, activeRegion, onSelectRegion, onStatewide }: {
  enabled: boolean
  touring: boolean
  regions: string[]
  activeRegion: string | null
  onSelectRegion: (region: string) => void
  onStatewide: () => void
}) {
  const map = useMap()

  useEffect(() => {
    if (enabled) {
      map.setMinZoom(5)
      map.setMaxZoom(12)
      map.dragging.enable()
      return
    }

    map.dragging.disable()
    map.setMinZoom(5)
    map.setMaxZoom(12)
  }, [enabled, map])

  const wasTouring = useRef(false)
  useEffect(() => {
    if (!enabled && !touring) {
      const resetView = () => {
        map.invalidateSize({ pan: false })
        resetStatewideView(map)
      }
      if (!wasTouring.current) resetView()
      wasTouring.current = touring
      const observer = new ResizeObserver(resetView)
      observer.observe(map.getContainer())
      return () => observer.disconnect()
    }
    wasTouring.current = touring
  }, [enabled, map, touring])

  return enabled ? (
    <MapToolbar regions={regions} activeRegion={activeRegion}
      onSelectRegion={onSelectRegion} onStatewide={() => {
        onStatewide()
        resetStatewideView(map)
      }} />
  ) : null
}

function regionStyle(selected: boolean): L.PathOptions {
  return {
    color: selected ? "var(--network-region-active-outline)" : "var(--network-region-outline)",
    fillColor: selected ? "var(--network-region-active-fill)" : "var(--network-region-fill)",
    weight: selected ? 3 : 1.25,
    opacity: 0.9,
    fillOpacity: 0.98,
  }
}

function MepRegionsLayer({
  showRegionLabels, activeRegion, fitRevision = 0, onRegionStatus, onGeometry,
}: {
  showRegionLabels: boolean
  activeRegion: string | null
  fitRevision?: number
  onRegionStatus: (region: string, error: string | null) => void
  onGeometry: (geometry: GeoJSON.GeoJsonObject) => void
}) {
  const map = useMap()
  const regionLabelsLayerRef = useRef<L.LayerGroup | null>(null)
  const showRegionLabelsRef = useRef(showRegionLabels)
  const [regionData, setRegionData] = useState<{
    layer: L.GeoJSON | null
    error: string | null
  }>({ layer: null, error: null })

  useEffect(() => {
    const { layer, error } = regionData
    if (error && activeRegion) {
      onRegionStatus(activeRegion, error)
      return
    }
    if (!layer) return
    let bounds: L.LatLngBounds | undefined
    layer.eachLayer((item) => {
      if (!(item instanceof L.Polygon)) return
      const selected = item.feature?.properties?.region_name?.trim() === activeRegion
      item.setStyle(regionStyle(selected))
      if (selected) bounds = bounds ? bounds.extend(item.getBounds()) : item.getBounds()
    })
    if (!activeRegion) return
    if (!bounds?.isValid()) {
      const message = `Unable to find the map boundary for ${activeRegion}.`
      console.error(message)
      onRegionStatus(activeRegion, message)
      return
    }
    const regionBounds = bounds
    const region = activeRegion
    function fitRegion() {
      map.invalidateSize({ pan: false })
      map.fitBounds(regionBounds, { padding: [36, 36], maxZoom: 10, animate: false })
      onRegionStatus(region, null)
    }
    fitRegion()
    map.on("resize", fitRegion)
    return () => { map.off("resize", fitRegion) }
  }, [activeRegion, fitRevision, regionData, map, onRegionStatus])

  useEffect(() => {
    showRegionLabelsRef.current = showRegionLabels
    const labelsLayer = regionLabelsLayerRef.current
    if (!labelsLayer) return

    if (showRegionLabels) labelsLayer.addTo(map)
    else labelsLayer.remove()
  }, [map, showRegionLabels])

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
        onGeometry(geoJson)

        const regionLabelsPane =
          map.getPane("region-labels") ?? map.createPane("region-labels")
        regionLabelsPane.style.zIndex = "590"
        regionLabelsPane.style.pointerEvents = "none"
        const labelsLayer = L.layerGroup()

        regionsLayer = L.geoJSON(geoJson, {
          interactive: false,
          style: regionStyle(false),
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
        setRegionData({ layer: regionsLayer, error: null })
        regionLabelsLayer = labelsLayer
        regionLabelsLayerRef.current = labelsLayer
        if (showRegionLabelsRef.current) labelsLayer.addTo(map)
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Failed to load NY MEP regions.", error)
          setRegionData({ layer: null, error: "Unable to load region boundaries. Reload the page to retry the tour." })
        }
      }
    }

    void loadRegions()

    return () => {
      controller.abort()
      regionsLayer?.remove()
      regionLabelsLayer?.remove()
      if (regionLabelsLayerRef.current === regionLabelsLayer) {
        regionLabelsLayerRef.current = null
      }
    }
  }, [map, onGeometry])

  return null
}

function fitConnectionLists(popup: HTMLElement, availableHeight: number) {
  const body = popup.querySelector<HTMLElement>(".network-popup")
  const lists = Array.from(popup.querySelectorAll<HTMLElement>(".network-popup__connection-list"))
  if (!body || !lists.length) return
  for (const list of lists) list.style.maxHeight = ""
  const overflow = body.offsetHeight - availableHeight
  if (overflow <= 0) return
  const share = Math.ceil(overflow / lists.length)
  for (const list of lists) list.style.maxHeight = `${Math.max(48, list.clientHeight - share)}px`
}

function PopupPlacement() {
  const map = useMap()

  useEffect(() => {
    let activePopup: L.Popup | null = null
    let revision = 0
    let placedTransform = ""
    const observer = new ResizeObserver(() => {
      void positionPopup()
    })
    const positionObserver = new MutationObserver(() => {
      if (activePopup?.getElement()?.style.transform !== placedTransform) {
        void positionPopup()
      }
    })
    const shell = map.getContainer().parentElement
    const obstacleObserver = new ResizeObserver(() => { void positionPopup() })
    const obstacleSelector = ".network-map-legend, .network-tour-inset"
    function observeObstacle() {
      obstacleObserver.disconnect()
      const obstacle = shell?.querySelector(obstacleSelector)
      if (obstacle) obstacleObserver.observe(obstacle)
      void positionPopup()
    }
    const shellObserver = new MutationObserver(observeObstacle)
    if (shell) shellObserver.observe(shell, { childList: true })
    observeObstacle()

    async function positionPopup() {
      const popup = activePopup
      const element = popup?.getElement()
      const location = popup?.getLatLng()
      if (!popup || !element || !location) return
      const currentRevision = ++revision
      const mapElement = map.getContainer()
      const size = map.getSize()
      const content = element.querySelector<HTMLElement>(".leaflet-popup-content")
      if (content) content.style.maxWidth = `${Math.max(40, size.x - 56)}px`
      fitConnectionLists(element, size.y - 80)

      let pointer = element.querySelector<HTMLElement>(".network-popup-arrow")
      if (!pointer) {
        pointer = document.createElement("span")
        pointer.className = "network-popup-arrow"
        pointer.setAttribute("aria-hidden", "true")
        element.appendChild(pointer)
      }
      const reference = {
        contextElement: mapElement,
        getBoundingClientRect() {
          const mapRect = mapElement.getBoundingClientRect()
          const point = map.latLngToContainerPoint(location)
          return new DOMRect(mapRect.left + point.x, mapRect.top + point.y, 0, 0)
        },
      }
      const mapRect = mapElement.getBoundingClientRect()
      const obstacleRect = shell?.querySelector(obstacleSelector)?.getBoundingClientRect()
      const segments = [...(connectionSegments.get(map)?.values() ?? [])].map(({ from, to }) => {
        const a = map.latLngToContainerPoint(from)
        const b = map.latLngToContainerPoint(to)
        return {
          from: { x: mapRect.left + a.x, y: mapRect.top + a.y },
          to: { x: mapRect.left + b.x, y: mapRect.top + b.y },
        }
      })
      const placements: Placement[] = [
        "top", "bottom", "left", "right",
        "top-start", "top-end", "bottom-start", "bottom-end",
        "left-start", "left-end", "right-start", "right-end",
      ]
      const candidates = await Promise.all(placements.map(async (placement) => {
        const result = await computePosition(reference, element, {
          placement,
          strategy: "fixed",
          // Leaflet transforms the popup pane; score candidates in viewport coordinates.
          platform: { ...platform, getOffsetParent: () => window },
          middleware: [
            offset(20),
            shift({ boundary: mapElement, padding: 12, crossAxis: true }),
            {
              name: "avoidMapOverlay",
              fn({ x, y, rects }) {
                if (!obstacleRect) return {}
                const width = rects.floating.width
                const height = rects.floating.height
                const rect = { left: x, top: y, right: x + width, bottom: y + height }
                if (!overlapArea(rect, obstacleRect)) return {}
                const options = [
                  { x: obstacleRect.left - width - 8, y },
                  { x: obstacleRect.right + 8, y },
                  { x, y: obstacleRect.top - height - 8 },
                  { x, y: obstacleRect.bottom + 8 },
                ]
                const valid = options.filter((point) =>
                  point.x >= mapRect.left + 12 && point.x + width <= mapRect.right - 12 &&
                  point.y >= mapRect.top + 12 && point.y + height <= mapRect.bottom - 12 &&
                  (placement.startsWith("top") ? point.y + height <= rects.reference.y :
                    placement.startsWith("bottom") ? point.y >= rects.reference.y :
                    placement.startsWith("left") ? point.x + width <= rects.reference.x :
                    point.x >= rects.reference.x)
                ).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
                if (!valid.length) return {}
                return valid[0]
              },
            },
            arrow({ element: pointer, padding: 10 }),
          ],
        })
        const { width, height } = element.getBoundingClientRect()
        const rect = { left: result.x, top: result.y, right: result.x + width, bottom: result.y + height }
        const anchorPoint = map.latLngToContainerPoint(location)
        const anchorX = mapRect.left + anchorPoint.x
        const anchorY = mapRect.top + anchorPoint.y
        const side = result.placement.split("-")[0]
        const sideOverflow = side === "top" ? rect.bottom - (anchorY - 16) :
          side === "bottom" ? anchorY + 16 - rect.top :
          side === "left" ? rect.right - (anchorX - 16) : anchorX + 16 - rect.left
        return {
          result,
          obstacleOverlap: obstacleRect ? overlapArea(rect, obstacleRect) : 0,
          sideOverflow: Math.max(0, sideOverflow),
          lineOverlap: segments.reduce((sum, segment) => sum + coveredConnectionLength(rect, segment), 0),
        }
      }))
      candidates.sort((a, b) => a.obstacleOverlap - b.obstacleOverlap ||
        a.sideOverflow - b.sideOverflow || a.lineOverlap - b.lineOverlap)
      const { result } = candidates[0]
      if (currentRevision !== revision || popup !== activePopup) return
      L.DomUtil.setPosition(element, map.containerPointToLayerPoint(
        L.point(result.x - mapRect.left, result.y - mapRect.top)
      ))
      placedTransform = element.style.transform
      const side = result.placement.split("-")[0]
      const oppositeSide = { top: "bottom", bottom: "top", left: "right", right: "left" }[side]!
      const arrowPosition = result.middlewareData.arrow
      Object.assign(pointer.style, {
        left: arrowPosition?.x == null ? "" : `${arrowPosition.x}px`,
        top: arrowPosition?.y == null ? "" : `${arrowPosition.y}px`,
        right: "",
        bottom: "",
        [oppositeSide]: "-4px",
      })
    }

    function onOpen(event: L.PopupEvent) {
      observer.disconnect()
      positionObserver.disconnect()
      activePopup = event.popup
      const element = activePopup.getElement()
      placedTransform = ""
      if (element) {
        observer.observe(element)
        positionObserver.observe(element, { attributes: true, attributeFilter: ["style"] })
      }
      void positionPopup()
    }

    function onClose(event: L.PopupEvent) {
      if (event.popup !== activePopup) return
      activePopup = null
      revision += 1
      observer.disconnect()
      positionObserver.disconnect()
    }

    function onMapChange() {
      void positionPopup()
    }

    map.on("popupopen", onOpen)
    map.on("popupclose", onClose)
    map.on("move zoomend resize", onMapChange)
    map.on(CONNECTION_GEOMETRY_EVENT, onMapChange)
    return () => {
      revision += 1
      activePopup = null
      observer.disconnect()
      positionObserver.disconnect()
      obstacleObserver.disconnect()
      shellObserver.disconnect()
      map.off("popupopen", onOpen)
      map.off("popupclose", onClose)
      map.off("move zoomend resize", onMapChange)
      map.off(CONNECTION_GEOMETRY_EVENT, onMapChange)
    }
  }, [map])

  return null
}

function locationKey(location: NystarLocationGroup) {
  return `${location.latitude}-${location.longitude}`
}

const SPREAD_SPACING_PX = 24
const SPREAD_MIN_RADIUS_PX = 16

// Programs are placed at ZIP centroids, so several can share a point. Give each its own
// marker on a small ring around that point, sized for the default zoom.
function spreadCoLocatedItems(locations: NystarLocationGroup[]): NystarLocationGroup[] {
  const lngPerPx = 360 / (256 * 2 ** DEFAULT_MAP_ZOOM)
  return locations.flatMap((location) => {
    const items = [
      ...location.assets.map((asset) => ({ assets: [asset], customers: [] })),
      ...location.customers.map((customer) => ({ assets: [], customers: [customer] })),
    ]
    if (items.length < 2) return [location]
    const radius = Math.max(SPREAD_MIN_RADIUS_PX, (items.length * SPREAD_SPACING_PX) / (2 * Math.PI))
    const latPerPx = lngPerPx * Math.cos((location.latitude * Math.PI) / 180)
    return items.map((item, index) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * index) / items.length
      return {
        ...location,
        ...item,
        latitude: location.latitude - radius * Math.sin(angle) * latPerPx,
        longitude: location.longitude + radius * Math.cos(angle) * lngPerPx,
      }
    })
  })
}

function OpenSelectedMapSelectionPopup({
  popupLocation,
  markerRefs,
  clusterRef,
  selectionRevision,
  mapPopupRequest,
  clusterMarkers,
  ready,
  onPopupReady,
}: {
  popupLocation: NystarLocationGroup | undefined
  markerRefs: RefObject<Map<string, L.Marker>>
  clusterRef: RefObject<L.MarkerClusterGroup | null>
  selectionRevision: number
  mapPopupRequest: MapPopupRequest | null
  clusterMarkers: boolean
  ready: boolean
  onPopupReady?: () => void
}) {
  const map = useMap()

  useLayoutEffect(() => {
    map.closePopup()
    if (!popupLocation || !ready) {
      return
    }

    let marker: L.Marker | undefined
    let group: L.MarkerClusterGroup | null = null
    let cancelled = false

    function revealMarker() {
      if (cancelled) return
      marker = markerRefs.current.get(locationKey(popupLocation!))
      if (!marker) return
      if (!clusterMarkers) {
        openPopup()
        return
      }
      group = clusterRef.current
      if (!group || !group.hasLayer(marker)) return
      if (mapPopupRequest?.selectionRevision === selectionRevision) {
        openPopup()
        return
      }
      const parent = group!.getVisibleParent(marker!)
      if (parent instanceof L.MarkerCluster) {
        group!.once("spiderfied", openPopup)
        parent.spiderfy()
      } else {
        openPopup()
      }
    }

    function openPopup() {
      if (!cancelled) {
        marker!.openPopup()
        onPopupReady?.()
      }
    }

    const registration = window.setTimeout(revealMarker, 0)
    return () => {
      cancelled = true
      window.clearTimeout(registration)
      group?.off("spiderfied", openPopup)
    }
  }, [clusterRef, clusterMarkers, popupLocation, map, markerRefs, mapPopupRequest, selectionRevision, ready, onPopupReady])

  return null
}

function TourMapEvents({ exitRevision, onManualInteraction }: {
  exitRevision: number
  onManualInteraction: () => void
}) {
  const map = useMapEvents({ click: () => {
    map.eachLayer((layer) => { if (layer instanceof L.Popup) layer.remove() })
    onManualInteraction()
  } })
  const previous = useRef(exitRevision)
  useEffect(() => {
    if (previous.current === exitRevision) return
    previous.current = exitRevision
    resetStatewideView(map)
  }, [exitRevision, map])
  return null
}

const CONNECTION_LINE_PANE = "connection-lines"
const CONNECTION_LINE_DURATION_MS = 1000

function ConnectionLines({
  connections,
  locations,
  selectedConnection,
  onSelectConnection,
}: {
  connections: RecentConnection[]
  locations: NystarLocationGroup[]
  selectedConnection: RecentConnection | null
  onSelectConnection: (connection: RecentConnection, position: L.LatLng) => void
}) {
  const map = useMap()
  const lines = useMemo(() => {
    const assetPositions = new Map<string, L.LatLng>()
    const partnerPositions = new Map<string, L.LatLng>()
    const names = new Map<string, string>()
    for (const location of locations) {
      const position = L.latLng(location.latitude, location.longitude)
      for (const asset of location.assets) assetPositions.set(asset.id, position)
      for (const customer of location.customers) partnerPositions.set(customer.id, position)
      for (const asset of location.assets) names.set(`asset:${asset.id}`, asset.name)
      for (const customer of location.customers) names.set(`partner:${customer.id}`, customer.name)
    }
    const seen = new Set<string>()
    return connections.flatMap((connection) => {
      const assetPosition = assetPositions.get(connection.fromAssetId)
      const targetPosition = (connection.to.kind === "asset" ? assetPositions : partnerPositions).get(connection.to.id)
      if (!assetPosition || !targetPosition) return []
      const [from, to] = connection.animateFromTarget
        ? [targetPosition, assetPosition]
        : [assetPosition, targetPosition]
      const key = `${connection.fromAssetId}>${connection.to.kind}:${connection.to.id}:${connection.connectionType}@${from.lat},${from.lng}>${to.lat},${to.lng}`
      if (seen.has(key)) return []
      seen.add(key)
      return [{
        key,
        from,
        to,
        desired: connection.connectionType === "Desired",
        connection,
        label: `${connection.connectionType} connection: ${names.get(`asset:${connection.fromAssetId}`)} and ${names.get(`${connection.to.kind}:${connection.to.id}`)}`,
      }]
    })
  }, [connections, locations])
  const linesRef = useRef(lines)
  const onSelectRef = useRef(onSelectConnection)
  const selectedRef = useRef(selectedConnection)
  const polylinesRef = useRef<L.Polyline[]>([])
  const linesKey = lines.map((line) => line.key).join("|")

  useEffect(() => {
    linesRef.current = lines
    onSelectRef.current = onSelectConnection
  }, [lines, onSelectConnection])

  useEffect(() => {
    selectedRef.current = selectedConnection
    polylinesRef.current.forEach((polyline, index) => {
      const line = linesRef.current[index]
      polyline.getElement()?.classList.toggle(
        "network-connection-line--selected",
        !!selectedConnection && !!line && connectionKey(line.connection) === connectionKey(selectedConnection)
      )
    })
  }, [selectedConnection, linesKey])

  useEffect(() => {
    const currentLines = linesRef.current
    if (currentLines.length === 0) return
    if (!map.getPane(CONNECTION_LINE_PANE)) {
      const pane = map.createPane(CONNECTION_LINE_PANE)
      pane.style.zIndex = "450"
      pane.style.pointerEvents = "none"
    }
    const polylines = currentLines.map((line) =>
      L.polyline([line.from, line.from], {
        pane: CONNECTION_LINE_PANE,
        interactive: false,
        className: line.desired
          ? "network-connection-line network-connection-line--desired"
          : "network-connection-line",
      }).addTo(map)
    )
    polylinesRef.current = polylines
    polylines.forEach((polyline, index) => {
      polyline.getElement()?.classList.toggle(
        "network-connection-line--selected",
        !!selectedRef.current && connectionKey(currentLines[index].connection) === connectionKey(selectedRef.current)
      )
    })
    const hitTargets = currentLines.map((line) =>
      L.polyline([line.from, line.to], {
        pane: CONNECTION_LINE_PANE,
        className: "network-connection-hit-target",
        weight: 14,
        opacity: 0,
        bubblingMouseEvents: false,
      }).on("click", (event: L.LeafletMouseEvent) => {
        map.eachLayer((layer) => { if (layer instanceof L.Popup) layer.remove() })
        onSelectRef.current(line.connection, event.latlng)
      }).addTo(map)
    )
    hitTargets.forEach((target, index) => {
      const element = target.getElement()
      if (!element) return
      const line = currentLines[index]
      element.setAttribute("tabindex", "0")
      element.setAttribute("role", "button")
      element.setAttribute("aria-label", line.label)
      element.addEventListener("keydown", (event: Event) => {
        if (!(event instanceof KeyboardEvent) || (event.key !== "Enter" && event.key !== " ")) return
        L.DomEvent.stop(event)
        map.eachLayer((layer) => { if (layer instanceof L.Popup) layer.remove() })
        onSelectRef.current(line.connection, L.latLng(
          (line.from.lat + line.to.lat) / 2,
          (line.from.lng + line.to.lng) / 2
        ))
      })
    })
    const segments = connectionSegments.get(map) ?? new Map()
    connectionSegments.set(map, segments)
    polylines.forEach((polyline, index) => {
      segments.set(polyline, { from: currentLines[index].from, to: currentLines[index].to })
    })
    map.fire(CONNECTION_GEOMETRY_EVENT)
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const start = performance.now()
    let frame = 0

    function draw(now: number) {
      const progress = reduceMotion
        ? 1
        : Math.min(1, (now - start) / CONNECTION_LINE_DURATION_MS)
      const eased = 1 - (1 - progress) ** 3
      polylines.forEach((polyline, index) => {
        const { from, to } = currentLines[index]
        polyline.setLatLngs([
          from,
          L.latLng(
            from.lat + (to.lat - from.lat) * eased,
            from.lng + (to.lng - from.lng) * eased
          ),
        ])
      })
      if (progress < 1) frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      polylines.forEach((polyline) => polyline.remove())
      hitTargets.forEach((polyline) => polyline.remove())
      polylinesRef.current = []
      polylines.forEach((polyline) => segments.delete(polyline))
      map.fire(CONNECTION_GEOMETRY_EVENT)
    }
  }, [map, linesKey])

  return null
}

function markerIcon(
  categories: string[],
  hasInnovationPartner: boolean,
  selected = false
) {
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
    className: selected ? "nystar-marker nystar-marker--selected" : "nystar-marker",
    html: `<span class="nystar-marker__symbols">${starContent}${customerDot}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  })
}

const POINT_LABEL_PANE = "point-labels"

type PointLabel = { id: string; position: L.LatLng; names: string[] }

function PointLabels({ labels }: { labels: PointLabel[] }) {
  const map = useMap()
  const [pane] = useState(() => {
    const existing = map.getPane(POINT_LABEL_PANE)
    if (existing) return existing
    const created = map.createPane(POINT_LABEL_PANE)
    created.style.zIndex = "640"
    created.style.pointerEvents = "none"
    return created
  })
  const labelRefs = useRef(new Map<string, HTMLSpanElement>())
  const [layout, setLayout] = useState<{ labels: PointLabel[]; placed: Map<string, PlacedLabel> } | null>(null)
  const [zooming, setZooming] = useState(false)

  useLayoutEffect(() => {
    // Measure the rendered labels, then lay them out in layer coordinates so they pan with the map.
    const update = () => {
      const size = map.getSize()
      const topLeft = map.containerPointToLayerPoint([0, 0])
      const containerRect = map.getContainer().getBoundingClientRect()
      const toLayerBox = (rect: DOMRect): Box => {
        const start = map.containerPointToLayerPoint([rect.left - containerRect.left, rect.top - containerRect.top])
        return { left: start.x, top: start.y, right: start.x + rect.width, bottom: start.y + rect.height }
      }
      const root = map.getContainer().parentElement ?? map.getContainer()
      const boxesFor = (selector: string) => [...root.querySelectorAll(selector)]
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map(toLayerBox)
      const placed = layoutPointLabels(
        labels.map((label) => {
          const point = map.latLngToLayerPoint(label.position)
          const element = labelRefs.current.get(label.id)
          // Wrapped text can leave the box wider than its lines, so measure the lines themselves.
          const left = element?.getBoundingClientRect().left ?? 0
          const textRight = Math.max(left, ...[...element?.querySelectorAll(".nystar-point-labels__text") ?? []]
            .flatMap((text) => [...text.getClientRects()].map((rect) => rect.right)))
          return {
            id: label.id,
            x: point.x,
            y: point.y,
            width: Math.ceil(textRight - left),
            height: element?.offsetHeight ?? 0,
          }
        }),
        { left: topLeft.x + 4, top: topLeft.y + 4, right: topLeft.x + size.x - 4, bottom: topLeft.y + size.y - 4 },
        {
          hard: boxesFor(".network-map-legend, .leaflet-control"),
          soft: boxesFor(".nystar-region-label__text"),
        }
      )
      setLayout({ labels, placed: new Map(placed.map((label) => [label.id, label])) })
      setZooming(false)
    }
    const hide = () => setZooming(true)
    update()
    map.on("zoomend viewreset resize moveend", update)
    map.on("zoomstart", hide)
    return () => {
      map.off("zoomend viewreset resize moveend", update)
      map.off("zoomstart", hide)
    }
  }, [labels, map])

  const placed = layout?.labels === labels ? layout.placed : null
  return createPortal(
    <div className="nystar-point-labels" data-hidden={zooming || !placed || undefined}>
      <svg className="nystar-point-labels__callouts" aria-hidden="true">
        {placed && [...placed.values()].filter((label) => label.callout).map((label) => {
          const anchor = calloutAnchor(label)
          return (
            <g key={label.id}>
              <line x1={label.pointX} y1={label.pointY} x2={anchor.x} y2={anchor.y} />
              <circle cx={label.pointX} cy={label.pointY} r={2} />
            </g>
          )
        })}
      </svg>
      {labels.map((label) => {
        const position = placed?.get(label.id)
        return (
          <span
            key={label.id}
            ref={(element) => {
              if (element) labelRefs.current.set(label.id, element)
              else labelRefs.current.delete(label.id)
            }}
            className="nystar-point-labels__label"
            style={{ transform: position ? `translate(${position.x}px, ${position.y}px)` : undefined }}
          >
            {label.names.map((name, index) => (
              <span key={index}><span className="nystar-point-labels__text">{name}</span></span>
            ))}
          </span>
        )
      })}
    </div>,
    pane
  )
}

function InsetRegions({ geometry, activeRegion }: {
  geometry: GeoJSON.GeoJsonObject
  activeRegion: string
}) {
  const map = useMap()
  useEffect(() => {
    const pane = map.getPane("inset-regions") ?? map.createPane("inset-regions")
    pane.style.zIndex = "300"
    const layer = L.geoJSON(geometry, {
      pane: "inset-regions",
      interactive: false,
      style: (feature) => ({
        ...regionStyle(feature?.properties?.region_name?.trim() === activeRegion),
        weight: feature?.properties?.region_name?.trim() === activeRegion ? 1.5 : 1,
      }),
    }).addTo(map)
    function fitState() {
      map.invalidateSize({ pan: false })
      map.fitBounds(layer.getBounds(), { padding: [16, 16], animate: false })
    }
    fitState()
    const observer = new ResizeObserver(fitState)
    observer.observe(map.getContainer())
    window.addEventListener("resize", fitState)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", fitState)
      layer.remove()
    }
  }, [map, geometry, activeRegion])
  return null
}

function TourInset({ geometry, activeRegion, assetId, locations, programConnections, error, label = "Statewide tour overview" }: {
  label?: string
  geometry: GeoJSON.GeoJsonObject | null
  activeRegion: string
  assetId: string
  locations: NystarLocationGroup[]
  programConnections: NystarProgramConnection[]
  error: string | null
}) {
  const data = useMemo(
    () => tourInsetData(assetId, programConnections, locations),
    [assetId, programConnections, locations]
  )
  const positions = new Map<string, L.LatLngExpression>()
  for (const location of data.locations) {
    for (const asset of location.assets) positions.set(`asset:${asset.id}`, [location.latitude, location.longitude])
    for (const customer of location.customers) positions.set(`partner:${customer.id}`, [location.latitude, location.longitude])
  }
  return (
    <aside className="network-tour-inset" aria-label={`${label}: ${activeRegion}`}>
      <h2 className="network-tour-inset__heading">{activeRegion}</h2>
      {error ? (
        <p className="network-tour-inset__status" role="alert">{error}</p>
      ) : !geometry ? (
        <p className="network-tour-inset__status" role="status">Loading statewide overview...</p>
      ) : (
        <MapContainer
          className="network-tour-inset__map"
          center={DEFAULT_MAP_CENTER} zoom={5} zoomSnap={0}
          zoomControl={false} attributionControl={false}
          dragging={false} scrollWheelZoom={false} doubleClickZoom={false}
          touchZoom={false} boxZoom={false} keyboard={false}
        >
          <InsetRegions geometry={geometry} activeRegion={activeRegion} />
          {data.connections.map((connection) => (
            <Polyline
              key={connectionKey(connection)}
              positions={[
                positions.get(`asset:${connection.fromAssetId}`)!,
                positions.get(`${connection.to.kind}:${connection.to.id}`)!,
              ]}
              interactive={false}
              className={connection.connectionType === "Desired"
                ? "network-connection-line network-connection-line--desired"
                : "network-connection-line"}
            />
          ))}
          {data.locations.flatMap((location) => [
            ...location.assets.map((asset) => (
              <Marker key={`asset:${asset.id}`}
                position={[location.latitude, location.longitude]}
                icon={markerIcon([asset.category], false)}
                interactive={false} keyboard={false} zIndexOffset={asset.id === assetId ? 1000 : 0}
              />
            )),
            ...location.customers.map((customer) => (
              <Marker key={`partner:${customer.id}`}
                position={[location.latitude, location.longitude]}
                icon={markerIcon([], true)}
                interactive={false} keyboard={false}
              />
            )),
          ])}
        </MapContainer>
      )}
    </aside>
  )
}

export default function NystarLeafletMap({
  locations: groupedLocations,
  programConnections,
  selectedProgramId,
  showAllConnections,
  selectedPartnerName,
  selectionRevision,
  showZoomControls,
  showMapLegend,
  legendCategory,
  onLegendCategoryChange,
  clusterMarkers: clusterMarkersSetting,
  showRegionLabels,
  showCityLabels,
  recentConnections,
  popupDismissRevision,
  onConnectProgram,
  onConnectPartner,
  onSelectItem,
  onPointClick,
  onClearSelection,
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
  legendCategory: string | null
  onLegendCategoryChange: (category: string | null) => void
  clusterMarkers: boolean
  showRegionLabels: boolean
  showCityLabels: boolean
  recentConnections: RecentConnection[]
  popupDismissRevision: number
  onConnectProgram?: (programId: string) => void
  onConnectPartner?: (partnerName: string) => void
  onSelectItem?: (item: MapItemSelection) => void
  onPointClick: () => void
  onClearSelection: () => void
  activeTourRegion: string | null
  tourExitRevision: number
  onTourStatus: (revision: number, error: string | null) => void
  onManualInteraction: () => void
}) {
  const [regionGeometry, setRegionGeometry] = useState<GeoJSON.GeoJsonObject | null>(null)
  // A region chosen from the map toolbar; the tour's region takes precedence over it.
  const [regionFocus, setRegionFocus] = useState<{ region: string; revision: number } | null>(null)
  if (regionFocus && (activeTourRegion || !showZoomControls)) setRegionFocus(null)
  const activeRegion = activeTourRegion ?? regionFocus?.region ?? null
  const regionNames = useMemo(() => {
    const features = (regionGeometry as GeoJSON.FeatureCollection | null)?.features ?? []
    return [...new Set(features
      .map((feature) => String(feature.properties?.region_name ?? "").trim())
      .filter(Boolean))].sort((left, right) => left.localeCompare(right))
  }, [regionGeometry])
  const [regionStatus, setRegionStatus] = useState<{ region: string; error: string | null } | null>(null)
  const onRegionStatus = useCallback((region: string, error: string | null) => {
    setRegionStatus({ region, error })
  }, [])
  const tourRegionReady = regionStatus?.region === activeTourRegion && !regionStatus?.error
  const onPopupReady = useCallback(() => {
    if (activeTourRegion && regionStatus?.region === activeTourRegion && !regionStatus.error) {
      onTourStatus(selectionRevision, null)
    }
  }, [activeTourRegion, onTourStatus, selectionRevision, regionStatus])
  useEffect(() => {
    if (activeTourRegion && regionStatus?.region === activeTourRegion && regionStatus.error) {
      onTourStatus(selectionRevision, regionStatus.error)
    }
  }, [activeTourRegion, regionStatus, onTourStatus, selectionRevision])
  const markerRefs = useRef(new Map<string, L.Marker>())
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const [legendPreview, setLegendPreview] = useState<{
    category: string
    revision: number
    selected: string | null
  } | null>(null)
  const previewCategory =
    legendPreview?.revision === selectionRevision &&
    legendPreview.selected === legendCategory
      ? legendPreview.category
      : null
  const effectiveCategory = showMapLegend && !activeRegion
    ? previewCategory ?? legendCategory
    : null
  // Point labels need individual markers, so clustering pauses while the legend filters.
  const clusterMarkers = clusterMarkersSetting && !effectiveCategory
  const [mapPopupRequest, setMapPopupRequest] = useState<MapPopupRequest | null>(null)
  const [connectionSelection, setConnectionSelection] = useState<{
    connection: RecentConnection
    position: L.LatLng
    revision: number
    dismissRevision: number
  } | null>(null)
  const [handledDismissRevision, setHandledDismissRevision] = useState(popupDismissRevision)
  const [handledCategory, setHandledCategory] = useState(effectiveCategory)
  const [popupDismissal, setPopupDismissal] = useState<{
    selectionRevision: number
    mapPopupRequest: MapPopupRequest | null
  } | null>(null)
  if (popupDismissRevision !== handledDismissRevision || effectiveCategory !== handledCategory) {
    setHandledCategory(effectiveCategory)
    setHandledDismissRevision(popupDismissRevision)
    setPopupDismissal({ selectionRevision, mapPopupRequest })
    setConnectionSelection(null)
  }
  // Popups stay dismissed until a new sidebar selection or marker click.
  const popupsDismissed =
    popupDismissal?.selectionRevision === selectionRevision &&
    popupDismissal.mapPopupRequest === mapPopupRequest
  // A selected point brings its connected points into the legend-filtered view.
  const legendFocus = useMemo(() => {
    if (!effectiveCategory || popupsDismissed) return undefined
    const customerIds = new Set(selectedProgramId || !selectedPartnerName ? [] : groupedLocations.flatMap(
      (location) => location.customers.filter((customer) => customer.name === selectedPartnerName).map((customer) => customer.id)
    ))
    const assetIds = new Set(selectedProgramId ? [selectedProgramId] : [])
    if (assetIds.size + customerIds.size === 0) return undefined
    for (const connection of connectionsForPopup(assetIds, customerIds, programConnections, groupedLocations)) {
      assetIds.add(connection.fromAssetId)
      if (connection.to.kind === "asset") assetIds.add(connection.to.id)
      else customerIds.add(connection.to.id)
    }
    return { assetIds, customerIds }
  }, [effectiveCategory, popupsDismissed, selectedProgramId, selectedPartnerName, programConnections, groupedLocations])
  const filteredLocations = useMemo(
    () => filterLegendLocations(groupedLocations, effectiveCategory, legendFocus),
    [groupedLocations, effectiveCategory, legendFocus]
  )
  const locations = useMemo(
    () => (clusterMarkers ? filteredLocations : spreadCoLocatedItems(filteredLocations)),
    [clusterMarkers, filteredLocations]
  )
  const activeConnection = connectionSelection?.revision === selectionRevision &&
    connectionSelection.dismissRevision === popupDismissRevision &&
    locations.some((location) => location.assets.some((asset) => asset.id === connectionSelection.connection.fromAssetId)) &&
    locations.some((location) => connectionSelection.connection.to.kind === "asset"
      ? location.assets.some((asset) => asset.id === connectionSelection.connection.to.id)
      : location.customers.some((customer) => customer.id === connectionSelection.connection.to.id))
    ? connectionSelection : null
  useEffect(() => {
    clusterRef.current?.refreshClusters()
  }, [activeConnection, clusterMarkers, selectionRevision])
  const selectConnection = useCallback((connection: RecentConnection, position: L.LatLng) => {
    onManualInteraction()
    setConnectionSelection({ connection, position, revision: selectionRevision, dismissRevision: popupDismissRevision })
  }, [onManualInteraction, selectionRevision, popupDismissRevision])
  const connectionAssets = locations.flatMap((location) => location.assets).filter((asset) =>
    activeConnection && (asset.id === activeConnection.connection.fromAssetId ||
      (activeConnection.connection.to.kind === "asset" && asset.id === activeConnection.connection.to.id))
  )
  const connectionCustomers = locations.flatMap((location) => location.customers).filter((customer) =>
    activeConnection?.connection.to.kind === "partner" && customer.id === activeConnection.connection.to.id
  )
  useEffect(() => {
    if (!popupDismissRevision) return
    const group = clusterRef.current as (L.MarkerClusterGroup & { unspiderfy?: () => void }) | null
    group?.unspiderfy?.()
  }, [popupDismissRevision])
  const showFullLocation = mapPopupRequest?.selectionRevision === selectionRevision
  const sidebarLocation = locations.find((location) =>
    selectedProgramId
      ? location.assets.some((asset) => asset.id === selectedProgramId)
      : location.customers.some((customer) => customer.name === selectedPartnerName)
  )
  const selectedCustomerId = sidebarLocation?.customers.find(
    (customer) => customer.name === selectedPartnerName
  )?.id
  const popupLocation = popupsDismissed
    ? undefined
    : showFullLocation
    ? locations.find((location) => locationKey(location) === mapPopupRequest.locationKey)
    : sidebarLocation
  const selectedLocationKey = popupLocation ? locationKey(popupLocation) : ""
  const popupAssetIds = new Set(
    (popupLocation?.assets ?? [])
      .filter((asset) => showFullLocation || asset.id === selectedProgramId)
      .map((asset) => asset.id)
  )
  const popupCustomerIds = new Set(
    (popupLocation?.customers ?? [])
      .filter((customer) =>
        showFullLocation || (!selectedProgramId && customer.name === selectedPartnerName)
      )
      .map((customer) => customer.id)
  )
  const popupAssetKey = [...popupAssetIds].sort().join("|")
  const popupCustomerKey = [...popupCustomerIds].sort().join("|")
  const popupConnections = useMemo(
    () => connectionsForPopup(
      new Set(showAllConnections
        ? groupedLocations.flatMap((location) => location.assets.map((asset) => asset.id))
        : popupAssetKey ? popupAssetKey.split("|") : []),
      new Set(showAllConnections
        ? groupedLocations.flatMap((location) => location.customers.map((customer) => customer.id))
        : popupCustomerKey ? popupCustomerKey.split("|") : []),
      programConnections,
      groupedLocations
    ),
    [showAllConnections, popupAssetKey, popupCustomerKey, programConnections, groupedLocations]
  )
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
  const pointLabels = useMemo(() => effectiveCategory
    ? locations.map((location) => ({
        id: `${locationKey(location)}:${[...location.assets.map((asset) => asset.id), ...location.customers.map((customer) => customer.id)].join("|")}`,
        position: L.latLng(location.latitude, location.longitude),
        names: [...location.assets.map((asset) => asset.name), ...location.customers.map((customer) => customer.name)],
      }))
    : [], [effectiveCategory, locations])
  const mapCategories = Array.from(
    new Set(groupedLocations.flatMap((location) => location.assets.map((asset) => asset.category)))
  ).sort((left, right) => left.localeCompare(right))
  const markers = locations.map((location) => {
    const selectedOnly = !showFullLocation && location === sidebarLocation
    const assets = selectedOnly
      ? location.assets.filter((asset) => asset.id === selectedProgramId)
      : location.assets
    const customers = selectedOnly
      ? location.customers.filter((customer) => !selectedProgramId && customer.id === selectedCustomerId)
      : location.customers
    return { location, assets, customers }
  })
  function popupConnectionsList(point: { kind: "asset" | "partner"; id: string }) {
    const organizations = connectedOrganizationsForPopup(point, programConnections, groupedLocations)
    if (organizations.length === 0) return null
    return (
      <section className="network-popup__connections" aria-label="Connected organizations">
        <h3 className="network-popup__primary">Connections ({organizations.length})</h3>
        <ul className="network-popup__connection-list">
          {organizations.map((organization) => (
            <li className="network-popup__connection" key={`${organization.kind}:${organization.id}`}>
              <span
                className={organization.kind === "asset" ? "network-popup__diamond" : "network-popup__dot"}
                style={organization.kind === "asset" ? {
                  "--marker-color": CATEGORY_COLORS[organization.category ?? ""] ?? "var(--network-customer-marker)",
                } as React.CSSProperties : undefined}
                aria-hidden="true"
              />
              <span>{organization.name}</span>
            </li>
          ))}
        </ul>
      </section>
    )
  }
  function popupDetails(
    assets: NystarLocationGroup["assets"],
    customers: NystarLocationGroup["customers"],
    showConnectionActions = true
  ) {
    return (
          <div className="network-popup">
            <ul className="network-popup__assets">
              {assets.map((asset) => (
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
                  {showConnectionActions && popupConnectionsList({ kind: "asset", id: asset.id })}
                  {showConnectionActions && onConnectProgram && (
                    <div className="network-popup__footer">
                      <Button
                        type="button"
                        variant="brand-link"
                        size="inline"
                        className="gap-1.5 text-xs [&_svg:not([class*='size-'])]:size-3.5"
                        onClick={() => onConnectProgram(asset.id)}
                      >
                        <Link data-icon="inline-start" />
                        Connect with this program
                      </Button>
                    </div>
                  )}
                </li>
              ))}
              {customers.map((customer) => (
                <li
                  className="network-popup__customer"
                  key={customer.id}
                >
                  <strong className="network-popup__name">
                    {customer.name}
                  </strong>
                  <div className="network-popup__category-row">
                    <span className="network-popup__dot" aria-hidden="true" />
                    <span className="network-popup__primary">
                      NYSTAR Innovation Partner
                    </span>
                  </div>
                  {(customer.addressLine1 || customer.addressLine2) && (
                    <span className="network-popup__category">
                      {[customer.addressLine1, customer.addressLine2]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                  <span className="network-popup__category">
                    {[
                      customer.city,
                      [customer.state, customer.zipCode].filter(Boolean).join(" "),
                    ].filter(Boolean).join(", ")}
                  </span>
                  {showConnectionActions && popupConnectionsList({ kind: "partner", id: customer.id })}
                  {showConnectionActions && onConnectPartner && (
                    <div className="network-popup__footer">
                      <Button
                        type="button"
                        variant="brand-link"
                        size="inline"
                        className="gap-1.5 text-xs [&_svg:not([class*='size-'])]:size-3.5"
                        onClick={() => onConnectPartner(customer.name.trim())}
                      >
                        <Link data-icon="inline-start" />
                        Add NYSTAR Connections
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
    )
  }
  const renderedMarkers = markers.map(({ location, assets, customers }) => {
    const selected = activeConnection
      ? location.assets.some((asset) => connectionAssets.some((item) => item.id === asset.id)) ||
        location.customers.some((customer) => connectionCustomers.some((item) => item.id === customer.id))
      : locationKey(location) === selectedLocationKey
    return (
      <Marker
        key={locationKey(location)}
        eventHandlers={{
          click: () => {
            setConnectionSelection(null)
            onPointClick()
            onManualInteraction()
            setMapPopupRequest({ locationKey: locationKey(location), selectionRevision })
            if (location.assets.length + location.customers.length !== 1) return
            const [asset] = location.assets
            const partnerName = location.customers[0]?.name.trim()
            if (asset) onSelectItem?.({ kind: "program", id: asset.id })
            else if (partnerName) onSelectItem?.({ kind: "partner", name: partnerName })
          },
        }}
        ref={(marker) => {
          const key = locationKey(location)
          if (marker) {
            markerItemCounts.set(marker, location.assets.length + location.customers.length)
            markerRefs.current.set(key, marker)
          } else markerRefs.current.delete(key)
        }}
        position={markerPositions.get(locationKey(location))!}
        zIndexOffset={selected ? 1000 : 0}
        icon={location.assets.length + location.customers.length > 1
          ? numberedMarkerIcon(location.assets.length + location.customers.length, selected)
          : markerIcon(location.assets.map((asset) => asset.category), location.customers.length > 0, selected)}
      >
        <Popup autoPan={false} closeButton={false} className="network-positioned-popup">
          {popupDetails(assets, customers)}
        </Popup>
      </Marker>
    )
  })
  return (
    <div className="network-map-shell">
      <MapContainer
      className="network-map-canvas"
      center={DEFAULT_MAP_CENTER}
      zoom={DEFAULT_MAP_ZOOM}
      minZoom={5}
      maxZoom={12}
      zoomSnap={0.25}
      zoomDelta={0.25}
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
      <PopupPlacement />
      <MapZoomControls enabled={showZoomControls} touring={!!activeRegion}
        regions={regionNames} activeRegion={activeRegion}
        onSelectRegion={(region) => {
          onManualInteraction()
          setRegionFocus((current) => ({ region, revision: (current?.revision ?? 0) + 1 }))
        }}
        onStatewide={() => {
          onManualInteraction()
          setRegionFocus(null)
        }} />
      <RecenterMapOnSidebarClose touring={!!activeRegion} />
      <TourMapEvents exitRevision={tourExitRevision} onManualInteraction={() => {
        setConnectionSelection(null)
        setMapPopupRequest(null)
        onClearSelection()
      }} />
      <MepRegionsLayer showRegionLabels={showRegionLabels} activeRegion={activeRegion}
        fitRevision={regionFocus?.revision}
        onRegionStatus={onRegionStatus} onGeometry={setRegionGeometry} />
      <OpenSelectedMapSelectionPopup
        popupLocation={activeConnection ? undefined : popupLocation}
        markerRefs={markerRefs}
        clusterRef={clusterRef}
        selectionRevision={selectionRevision}
        mapPopupRequest={mapPopupRequest}
        clusterMarkers={clusterMarkers}
        ready={!activeTourRegion || tourRegionReady}
        onPopupReady={onPopupReady}
      />
      {clusterMarkers ? (
        <MarkerClusterGroup
          ref={clusterRef}
          maxClusterRadius={40}
          iconCreateFunction={clusterIcon}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={false}
          spiderfyOnEveryZoom
          animate={false}
          spiderLegPolylineOptions={{ color: "var(--network-city-label)", weight: 1, opacity: 0.7 }}
        >
          {renderedMarkers}
        </MarkerClusterGroup>
      ) : renderedMarkers}
      {activeConnection && (
        <Popup key={`${connectionKey(activeConnection.connection)}:${activeConnection.position.toString()}`}
          position={activeConnection.position} autoPan={false} closeButton={false}
          className="network-positioned-popup">
          {popupDetails(connectionAssets, connectionCustomers, false)}
        </Popup>
      )}
      <ConnectionLines
        connections={popupConnections}
        locations={locations}
        selectedConnection={activeConnection?.connection ?? null}
        onSelectConnection={selectConnection}
      />
      <ConnectionLines
        connections={recentConnections}
        locations={locations}
        selectedConnection={activeConnection?.connection ?? null}
        onSelectConnection={selectConnection}
      />
      <Pane
        name="city-labels"
        style={{ zIndex: 650, pointerEvents: "none" }}
      >
        {showCityLabels && !effectiveCategory && cityLabels.map(({ name, position, offset }) => (
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
      {effectiveCategory && <PointLabels labels={pointLabels} />}
      </MapContainer>
        {activeRegion && (
          <TourInset geometry={regionGeometry} activeRegion={activeRegion}
            label={activeTourRegion ? "Statewide tour overview" : "Statewide overview"}
            assetId={selectedProgramId} locations={groupedLocations}
            programConnections={programConnections}
            error={regionStatus?.region === activeRegion ? regionStatus.error : null} />
        )}
        {showMapLegend && !activeRegion && (
          <aside
            className="network-map-legend"
            aria-label="Map legend"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                setLegendPreview(null)
                onLegendCategoryChange(null)
              }
            }}
          >
            <div className="network-map-legend__logo">
              <Image src="/nystar-logo-new.jpeg" alt="New York State Division of Science, Technology & Innovation, a division of Empire State Development" width={561} height={401} loading="eager" />
            </div>
            <h2 className="network-map-legend__title">NYSTAR Programs</h2>
            <ul className="network-map-legend__items">
              {mapCategories.map((category) => (
                <li key={category}>
                  <button
                    type="button"
                    className="network-map-legend__item network-map-legend__category"
                    title="Hover to preview; click to toggle this category filter"
                    aria-pressed={legendCategory === category}
                    data-preview={previewCategory === category}
                    onPointerEnter={(event) => {
                      if (event.pointerType !== "touch") {
                        setLegendPreview({ category, revision: selectionRevision, selected: legendCategory })
                      }
                    }}
                    onPointerLeave={() => setLegendPreview(null)}
                    onFocus={() => setLegendPreview({ category, revision: selectionRevision, selected: legendCategory })}
                    onBlur={() => setLegendPreview(null)}
                    onClick={() => {
                      setLegendPreview(null)
                      onLegendCategoryChange(legendCategory === category ? null : category)
                    }}
                  >
                    <span
                      className="network-map-legend__star"
                      style={{
                        "--marker-color": CATEGORY_COLORS[category] ?? "var(--network-customer-marker)",
                      } as React.CSSProperties}
                      aria-hidden="true"
                    />
                    <span>{category.replace(/\bNew York\b/g, "NY")}</span>
                  </button>
                </li>
              ))}
            </ul>
            <h2 className="network-map-legend__title network-map-legend__title--section">
              Innovation Partners
            </h2>
            <ul className="network-map-legend__items">
              <li>
                <button
                  type="button"
                  className="network-map-legend__item network-map-legend__category"
                  title="Hover to preview; click to toggle this category filter"
                  aria-pressed={legendCategory === CUSTOMER_LEGEND_FILTER}
                  data-preview={previewCategory === CUSTOMER_LEGEND_FILTER}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== "touch") {
                      setLegendPreview({ category: CUSTOMER_LEGEND_FILTER, revision: selectionRevision, selected: legendCategory })
                    }
                  }}
                  onPointerLeave={() => setLegendPreview(null)}
                  onFocus={() => setLegendPreview({ category: CUSTOMER_LEGEND_FILTER, revision: selectionRevision, selected: legendCategory })}
                  onBlur={() => setLegendPreview(null)}
                  onClick={() => {
                    setLegendPreview(null)
                    onLegendCategoryChange(legendCategory === CUSTOMER_LEGEND_FILTER ? null : CUSTOMER_LEGEND_FILTER)
                  }}
                >
                <span
                  className="network-map-legend__dot"
                  aria-hidden="true"
                />
                <span>Customer organization</span>
                </button>
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
