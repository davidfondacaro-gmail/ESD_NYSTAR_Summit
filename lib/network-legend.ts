import type { NystarLocationGroup } from "./nystar-locations"

export type LegendFilterExtras = {
  assetIds: ReadonlySet<string>
  customerIds: ReadonlySet<string>
}

// Extras keep a selected point and everything it connects to visible regardless of category.
export function filterLegendLocations(
  locations: NystarLocationGroup[],
  category: string | null,
  extras?: LegendFilterExtras
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
      assets: location.assets.filter(
        (asset) => assetIds.has(asset.id) || !!extras?.assetIds.has(asset.id)
      ),
      customers: location.customers.filter(
        (customer) =>
          !!extras?.customerIds.has(customer.id) ||
          customer.connections.some((connection) => assetIds.has(connection.assetId))
      ),
    }))
    .filter((location) => location.assets.length + location.customers.length > 0)
}
