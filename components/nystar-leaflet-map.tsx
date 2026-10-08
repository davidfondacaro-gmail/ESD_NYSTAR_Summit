"use client"

import L from "leaflet"
import { useEffect } from "react"
import MarkerClusterGroup from "react-leaflet-cluster"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"

import type { NystarLocationGroup } from "@/lib/nystar-locations"

function FitLocations({ locations }: { locations: NystarLocationGroup[] }) {
  const map = useMap()

  useEffect(() => {
    const bounds = L.latLngBounds(
      locations.map(({ latitude, longitude }) =>
        L.latLng(latitude, longitude),
      ),
    )

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 9 })
    }
  }, [locations, map])

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
}: {
  locations: NystarLocationGroup[]
}) {
  return (
    <MapContainer
      className="network-map-canvas"
      center={[42.95, -75.5]}
      zoom={7}
      minZoom={5}
      zoomSnap={0.5}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitLocations locations={locations} />
      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        maxClusterRadius={36}
      >
        {locations.map((location) => (
            <Marker
              key={`${location.latitude}-${location.longitude}`}
              position={[location.latitude, location.longitude]}
              icon={markerIcon(location.assets.length + location.customers.length)}
              title={`${location.assets.length + location.customers.length} network ${location.assets.length + location.customers.length === 1 ? "location" : "locations"} near ${location.cities.join(", ")}`}
            >
            <Popup>
              <div className="network-popup">
                <p className="network-popup__place">
                  {location.cities.join(" / ")}, NY · ZIP {location.zipCodes.join(", ")} · Approximate ZIP center
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
                      {customer.connectedAssetNames.length > 0 && (
                        <span className="network-popup__host">
                          Connected to: {customer.connectedAssetNames.join(", ")}
                        </span>
                      )}
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