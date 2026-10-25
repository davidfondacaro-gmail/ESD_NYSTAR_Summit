import type {
  NystarLocationGroup,
  NystarProgramGroup,
} from "./nystar-locations"

export const TOUR_DWELL_MS = 4_000

export type TourStop = { region: string; assetId: string; name: string }

export function buildTourStops(
  regions: NystarProgramGroup[],
  locations: NystarLocationGroup[]
): TourStop[] {
  const mapped = new Set(
    locations.flatMap((location) => location.assets.map((asset) => asset.id))
  )
  const seen = new Set<string>()
  return [...regions]
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((region) =>
      [...region.programs]
        .sort(
          (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
        )
        .filter((program) => {
          if (!mapped.has(program.id) || seen.has(program.id)) return false
          seen.add(program.id)
          return true
        })
        .map((program) => ({
          region: region.name,
          assetId: program.id,
          name: program.name,
        }))
    )
}

export function scopedTourStops(stops: TourStop[], scope: string) {
  return scope === "all" ? stops : stops.filter((stop) => stop.region === scope)
}

export function nextTourIndex(index: number, count: number) {
  return count === 0 ? 0 : (index + 1) % count
}
