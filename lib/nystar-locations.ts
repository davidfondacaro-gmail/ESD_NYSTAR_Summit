import "server-only"

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import Papa from "papaparse"
import zipcodes from "zipcodes"

export type NystarAsset = {
  id: string
  name: string
  category: string
  hostOrganization: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
}

export type NystarConnectionType = "Existing" | "Desired"

export type NystarCustomerConnection = {
  id: string
  assetId: string
  assetName: string
  hostOrganization: string
  connectionType: NystarConnectionType
  createdAt: string
}

export type NystarCustomerLocation = {
  id: string
  name: string
  addressLine1: string
  addressLine2: string
  connections: NystarCustomerConnection[]
}

export type NystarLocationGroup = {
  latitude: number
  longitude: number
  cities: string[]
  zipCodes: string[]
  assets: NystarAsset[]
  customers: NystarCustomerLocation[]
}

export type NystarProgramOption = {
  id: string
  name: string
  category: string
  details: string
}

export type NystarProgramGroup = {
  name: string
  programs: NystarProgramOption[]
}

export type NystarNetworkData = {
  locations: NystarLocationGroup[]
  categories: NystarProgramGroup[]
  regions: NystarProgramGroup[]
  tourRegions: string[]
}

type NystarCsvRow = {
  ID: string
  Region: string
  "NYSTAR Program Category": string
  "Asset / Program Name": string
  "Host Organization": string
  "Address Line 1": string
  "Address Line 2": string
  City: string
  State: string
  "ZIP Code": string
}

type CustomerCsvRow = {
  "Customer ID": string
  "Organization Name": string
  "Address Line 1": string
  "Address Line 2": string
  City: string
  State: string
  "ZIP Code": string
  Xlong: string
  Ylat: string
}

type CustomerConnectionCsvRow = {
  "Connection ID": string
  "Customer ID": string
  "NYSTAR Asset ID": string
  "Connection Type": string
  "Created At": string
}

export async function getNystarNetworkData(): Promise<NystarNetworkData> {
  const dataDirectory = join(process.cwd(), "public", "data")
  const [nystarCsv, customerCsv, connectionsCsv, mepRegionsJson] =
    await Promise.all([
      readFile(
        join(
          dataDirectory,
          "nystar-innovation-assets-map-base-layer-lgw.csv"
        ),
        "utf8"
      ),
      readFile(join(dataDirectory, "customer-locations.csv"), "utf8"),
      readFile(join(dataDirectory, "nystar-customer-connections.csv"), "utf8"),
      readFile(join(dataDirectory, "ny_mep_regions.geojson"), "utf8"),
    ])
  const mepRegions = JSON.parse(mepRegionsJson) as {
    features?: { properties?: { region_name?: string } }[]
  }
  const tourRegions = Array.from(
    new Set(
      (mepRegions.features ?? [])
        .map((feature) => feature.properties?.region_name?.trim())
        .filter((region): region is string => Boolean(region))
    )
  ).sort((left, right) => left.localeCompare(right))
  const { data: nystarRows } = Papa.parse<NystarCsvRow>(nystarCsv, {
    header: true,
    skipEmptyLines: true,
  })
  const { data: customerRows } = Papa.parse<CustomerCsvRow>(customerCsv, {
    header: true,
    skipEmptyLines: true,
  })
  const { data: connectionRows } = Papa.parse<CustomerConnectionCsvRow>(
    connectionsCsv,
    {
      header: true,
      skipEmptyLines: true,
    }
  )
  const groups = new Map<string, NystarLocationGroup>()
  const categoryPrograms = new Map<string, NystarProgramOption[]>()
  const regionPrograms = new Map<string, NystarProgramOption[]>()
  const assetsById = new Map<string, NystarAsset>()

  function getGroup(latitude: number, longitude: number) {
    const key = `${latitude},${longitude}`
    let group = groups.get(key)

    if (!group) {
      group = {
        latitude,
        longitude,
        cities: [],
        zipCodes: [],
        assets: [],
        customers: [],
      }
      groups.set(key, group)
    }

    return group
  }

  for (const row of nystarRows) {
    const category = row["NYSTAR Program Category"]?.trim()
    const region = row.Region?.trim() || "Unassigned"
    const name = row["Asset / Program Name"]?.trim()
    const id = row.ID?.trim()
    const hostOrganization = row["Host Organization"]?.trim() ?? ""
    const city = row.City?.trim() ?? ""
    const state = row.State?.trim() ?? ""
    const zipCode = row["ZIP Code"]?.trim() ?? ""

    if (category && name && id) {
      const locality = [city, [state, zipCode].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ")
      const details = [hostOrganization, locality].filter(Boolean).join(" · ")
      const asset: NystarAsset = {
        id,
        name,
        category,
        hostOrganization,
        addressLine1: row["Address Line 1"]?.trim() ?? "",
        addressLine2: row["Address Line 2"]?.trim() ?? "",
        city,
        state,
        zipCode,
      }
      const program = { id, name, category, details }
      const categoryList = categoryPrograms.get(category) ?? []
      const regionList = regionPrograms.get(region) ?? []

      categoryList.push(program)
      regionList.push(program)
      categoryPrograms.set(category, categoryList)
      regionPrograms.set(region, regionList)
      assetsById.set(id, asset)
    }
  }

  for (const row of nystarRows) {
    const category = row["NYSTAR Program Category"]?.trim() ?? ""
    const name = row["Asset / Program Name"]?.trim()
    const id = row.ID?.trim()
    const hostOrganization = row["Host Organization"]?.trim() ?? ""
    const city = row.City?.trim() ?? ""
    const state = row.State?.trim() ?? ""
    const zipCode = row["ZIP Code"]?.trim() ?? ""

    if (!id || !name || state !== "NY" || !/^\d{5}$/.test(zipCode)) {
      continue
    }

    const coordinates = zipcodes.lookup(zipCode)

    if (!coordinates || coordinates.state !== "NY") {
      continue
    }

    const group = getGroup(coordinates.latitude, coordinates.longitude)

    if (city && !group.cities.includes(city)) {
      group.cities.push(city)
    }
    if (!group.zipCodes.includes(zipCode)) {
      group.zipCodes.push(zipCode)
    }

    const metadata = assetsById.get(id)
    group.assets.push({
      id,
      name,
      category: metadata?.category ?? category,
      hostOrganization,
      addressLine1: row["Address Line 1"]?.trim() ?? "",
      addressLine2: row["Address Line 2"]?.trim() ?? "",
      city,
      state,
      zipCode,
    })
  }

  const connectionsByCustomerId = new Map<string, NystarCustomerConnection[]>()

  for (const row of connectionRows) {
    const connectionId = row["Connection ID"]?.trim()
    const customerId = row["Customer ID"]?.trim()
    const assetId = row["NYSTAR Asset ID"]?.trim()
    const connectionType = row["Connection Type"]?.trim()
    const asset = assetsById.get(assetId)

    if (
      !connectionId ||
      !customerId ||
      !asset ||
      (connectionType !== "Existing" && connectionType !== "Desired")
    ) {
      continue
    }

    const customerConnections = connectionsByCustomerId.get(customerId) ?? []
    customerConnections.push({
      id: connectionId,
      assetId,
      assetName: asset.name,
      hostOrganization: asset.hostOrganization,
      connectionType,
      createdAt: row["Created At"]?.trim() ?? "",
    })
    connectionsByCustomerId.set(customerId, customerConnections)
  }

  for (const row of customerRows) {
    const customerId = row["Customer ID"]?.trim()
    const name = row["Organization Name"]?.trim()
    const city = row.City?.trim() ?? ""
    const state = row.State?.trim() ?? ""
    const zipCode = row["ZIP Code"]?.trim() ?? ""
    const longitudeText = row.Xlong?.trim() ?? ""
    const latitudeText = row.Ylat?.trim() ?? ""
    const longitude = Number(longitudeText)
    const latitude = Number(latitudeText)

    if (!customerId || !name || state !== "NY") {
      continue
    }

    const zipCoordinates = zipCode ? zipcodes.lookup(zipCode) : undefined
    const coordinates =
      longitudeText !== "" &&
      latitudeText !== "" &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
        ? { latitude, longitude }
        : zipCoordinates?.state === "NY"
          ? {
              latitude: zipCoordinates.latitude,
              longitude: zipCoordinates.longitude,
            }
          : null

    if (!coordinates) {
      continue
    }

    const group = getGroup(coordinates.latitude, coordinates.longitude)

    if (city && !group.cities.includes(city)) {
      group.cities.push(city)
    }
    if (zipCode && !group.zipCodes.includes(zipCode)) {
      group.zipCodes.push(zipCode)
    }

    group.customers.push({
      id: customerId,
      name,
      addressLine1: row["Address Line 1"]?.trim() ?? "",
      addressLine2: row["Address Line 2"]?.trim() ?? "",
      connections: connectionsByCustomerId.get(customerId) ?? [],
    })
  }

  return {
    locations: [...groups.values()],
    tourRegions,
    categories: [...categoryPrograms.entries()]
      .map(([name, programs]) => ({ name, programs }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    regions: [...regionPrograms.entries()]
      .map(([name, programs]) => ({ name, programs }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}
