import type { FeatureCollection, Position } from "geojson"

type MapPoint = { longitude: number; latitude: number }

function containsRing(point: MapPoint, ring: Position[]) {
  let inside = false

  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentLongitude, currentLatitude] = ring[current]
    const [previousLongitude, previousLatitude] = ring[previous]
    const cross =
      (point.longitude - currentLongitude) * (previousLatitude - currentLatitude) -
      (point.latitude - currentLatitude) * (previousLongitude - currentLongitude)

    if (
      Math.abs(cross) < 1e-10 &&
      point.longitude >= Math.min(currentLongitude, previousLongitude) - 1e-10 &&
      point.longitude <= Math.max(currentLongitude, previousLongitude) + 1e-10 &&
      point.latitude >= Math.min(currentLatitude, previousLatitude) - 1e-10 &&
      point.latitude <= Math.max(currentLatitude, previousLatitude) + 1e-10
    ) {
      return true
    }

    const crossesLatitude =
      (currentLatitude > point.latitude) !== (previousLatitude > point.latitude)
    const crossingLongitude =
      ((previousLongitude - currentLongitude) * (point.latitude - currentLatitude)) /
        (previousLatitude - currentLatitude) + currentLongitude

    if (crossesLatitude && point.longitude < crossingLongitude) {
      inside = !inside
    }
  }

  return inside
}

function containsPolygon(point: MapPoint, polygon: Position[][]) {
  return (
    polygon.length > 0 &&
    containsRing(point, polygon[0]) &&
    !polygon.slice(1).some((hole) => containsRing(point, hole))
  )
}

export function regionForPoint(
  point: MapPoint | null,
  regions: FeatureCollection
) {
  if (
    !point ||
    !Number.isFinite(point.longitude) ||
    !Number.isFinite(point.latitude) ||
    Math.abs(point.longitude) > 180 ||
    Math.abs(point.latitude) > 90
  ) {
    return "Unassigned"
  }

  const feature = regions.features.find(({ geometry }) => {
    if (geometry?.type === "Polygon") {
      return containsPolygon(point, geometry.coordinates)
    }
    if (geometry?.type === "MultiPolygon") {
      return geometry.coordinates.some((polygon) => containsPolygon(point, polygon))
    }
    return false
  })
  const name = feature?.properties?.region_name
  return typeof name === "string" && name.trim() ? name.trim() : "Unassigned"
}