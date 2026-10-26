import type { NystarLocationGroup } from "./nystar-locations"

export function filterLegendLocations(
  locations: NystarLocationGroup[],
  category: string | null
): NystarLocationGroup[] {
  if (!category) return locations
  const assetIds = new Set(
    locations.flatMap((location) =>
      location.assets
        .filter((asset) => asset.category === category)
        .map((asset) => asset.id)
    )
  )
  return locations
    .map((location) => ({
      ...location,
      assets: location.assets.filter((asset) => assetIds.has(asset.id)),
      customers: location.customers.filter((customer) =>
        customer.connections.some((connection) => assetIds.has(connection.assetId))
      ),
    }))
    .filter((location) => location.assets.length + location.customers.length > 0)
}
