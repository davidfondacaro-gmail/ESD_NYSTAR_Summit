import type {
  NystarLocationGroup,
  NystarProgramConnection,
} from "./nystar-locations"
import type { RecentConnection } from "./recent-connection"

export function connectionKey(connection: RecentConnection) {
  const endpoints = [
    `asset:${connection.fromAssetId}`,
    `${connection.to.kind}:${connection.to.id}`,
  ].sort()
  return `${endpoints.join(">")}:${connection.connectionType}`
}

export function connectionsForPopup(
  assetIds: Set<string>,
  customerIds: Set<string>,
  programConnections: NystarProgramConnection[],
  locations: NystarLocationGroup[]
): RecentConnection[] {
  if (assetIds.size === 0 && customerIds.size === 0) return []
  const connections: RecentConnection[] = []
  for (const connection of programConnections) {
    const [fromAssetId, toAssetId] = assetIds.has(connection.assetId1)
      ? [connection.assetId1, connection.assetId2]
      : [connection.assetId2, connection.assetId1]
    if (!assetIds.has(fromAssetId)) continue
    connections.push({
      fromAssetId,
      to: { kind: "asset", id: toAssetId },
      connectionType: connection.connectionType,
    })
  }
  for (const location of locations) {
    for (const customer of location.customers) {
      for (const connection of customer.connections) {
        const fromAsset = assetIds.has(connection.assetId)
        if (!fromAsset && !customerIds.has(customer.id)) continue
        connections.push({
          fromAssetId: connection.assetId,
          to: { kind: "partner", id: customer.id },
          connectionType: connection.connectionType,
          animateFromTarget: !fromAsset,
        })
      }
    }
  }
  return connections
}

export function tourInsetData(
  assetId: string,
  programConnections: NystarProgramConnection[],
  locations: NystarLocationGroup[]
) {
  const mappedAssets = new Set(
    locations.flatMap((location) => location.assets.map((asset) => asset.id))
  )
  const mappedCustomers = new Set(
    locations.flatMap((location) =>
      location.customers.map((customer) => customer.id)
    )
  )
  const seen = new Set<string>()
  const connections = connectionsForPopup(
    new Set([assetId]),
    new Set(),
    programConnections,
    locations
  ).filter((connection) => {
    const key = connectionKey(connection)
    if (
      seen.has(key) ||
      !mappedAssets.has(connection.fromAssetId) ||
      !(connection.to.kind === "asset" ? mappedAssets : mappedCustomers).has(
        connection.to.id
      )
    )
      return false
    seen.add(key)
    return true
  })
  const assetIds = new Set([assetId])
  const customerIds = new Set<string>()
  for (const connection of connections) {
    assetIds.add(connection.fromAssetId)
    if (connection.to.kind === "asset") assetIds.add(connection.to.id)
    else customerIds.add(connection.to.id)
  }

  return {
    connections,
    locations: locations
      .map((location) => ({
        ...location,
        assets: location.assets.filter((asset) => assetIds.has(asset.id)),
        customers: location.customers.filter((customer) =>
          customerIds.has(customer.id)
        ),
      }))
      .filter(
        (location) => location.assets.length + location.customers.length > 0
      ),
  }
}

export type ConnectedOrganization = {
  id: string
  kind: "asset" | "partner"
  name: string
  category?: string
}

export function existingConnectionTargets(
  assetId: string,
  programConnections: NystarProgramConnection[],
  locations: NystarLocationGroup[]
) {
  const connections = connectionsForPopup(
    new Set([assetId]),
    new Set(),
    programConnections,
    locations
  )
  const programIds = new Set<string>()
  const partnerIds = new Set<string>()
  for (const connection of connections) {
    if (connection.to.kind === "asset") programIds.add(connection.to.id)
    else partnerIds.add(connection.to.id)
  }
  const partnerNames = locations.flatMap((location) =>
    location.customers
      .filter((customer) => partnerIds.has(customer.id))
      .map((customer) => customer.name)
  )
  return { programIds, partnerNames }
}

export function connectedOrganizationsForPopup(
  point: { kind: "asset" | "partner"; id: string },
  programConnections: NystarProgramConnection[],
  locations: NystarLocationGroup[]
): ConnectedOrganization[] {
  const connections = connectionsForPopup(
    new Set(point.kind === "asset" ? [point.id] : []),
    new Set(point.kind === "partner" ? [point.id] : []),
    programConnections,
    locations
  )
  const assetIds = new Set<string>()
  const partnerIds = new Set<string>()
  for (const connection of connections) {
    if (point.kind === "partner") {
      assetIds.add(connection.fromAssetId)
    } else if (connection.to.kind === "asset") {
      assetIds.add(connection.to.id)
    } else {
      partnerIds.add(connection.to.id)
    }
  }
  if (point.kind === "asset") assetIds.delete(point.id)
  else partnerIds.delete(point.id)
  const organizations = new Map<string, ConnectedOrganization>()
  for (const location of locations) {
    for (const asset of location.assets) {
      if (assetIds.has(asset.id)) {
        organizations.set(`asset:${asset.id}`, {
          id: asset.id,
          kind: "asset",
          name: asset.name,
          category: asset.category,
        })
      }
    }
    for (const customer of location.customers) {
      if (partnerIds.has(customer.id)) {
        organizations.set(`partner:${customer.id}`, {
          id: customer.id,
          kind: "partner",
          name: customer.name,
        })
      }
    }
  }
  return [...organizations.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name) ||
      left.kind.localeCompare(right.kind) ||
      left.id.localeCompare(right.id)
  )
}
