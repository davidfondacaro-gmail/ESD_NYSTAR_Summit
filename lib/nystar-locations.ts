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
}

export type NystarCustomerLocation = {
  id: string
  name: string
  addressLine1: string
  addressLine2: string
  connectedAssetNames: string[]
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
  "Organization Name": string
  "Address Line 1": string
  "Address Line 2": string
  City: string
  State: string
  "ZIP Code": string
  Xlong: string
  Ylat: string
  Connections: string
}

export async function getNystarNetworkData(): Promise<NystarNetworkData> {
  const dataDirectory = join(process.cwd(), "public", "data")
  const [nystarCsv, customerCsv] = await Promise.all([
    readFile(join(dataDirectory, "nystar-locations.csv"), "utf8"),
    readFile(join(dataDirectory, "customer-locations.csv"), "utf8"),
  ])
  const { data: nystarRows } = Papa.parse<NystarCsvRow>(nystarCsv, {
    header: true,
    skipEmptyLines: true,
  })
  const { data: customerRows } = Papa.parse<CustomerCsvRow>(customerCsv, {
    header: true,
    skipEmptyLines: true,
  })
  const groups = new Map<string, NystarLocationGroup>()
  const categoryPrograms = new Map<string, NystarProgramOption[]>()
  const regionPrograms = new Map<string, NystarProgramOption[]>()
  const assetNames = new Map<string, string>()

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
      const program = { id, name, category, details }
      const categoryList = categoryPrograms.get(category) ?? []
      const regionList = regionPrograms.get(region) ?? []

      categoryList.push(program)
      regionList.push(program)
      categoryPrograms.set(category, categoryList)
      regionPrograms.set(region, regionList)
      assetNames.set(id, name)
    }

    if (!name || state !== "NY" || !/^\d{5}$/.test(zipCode)) {
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

    group.assets.push({
      id,
      name,
      category: row["NYSTAR Program Category"]?.trim() ?? "",
      hostOrganization: row["Host Organization"]?.trim() ?? "",
    })
  }

  for (const [rowIndex, row] of customerRows.entries()) {
    const name = row["Organization Name"]?.trim()
    const city = row.City?.trim() ?? ""
    const state = row.State?.trim() ?? ""
    const zipCode = row["ZIP Code"]?.trim() ?? ""
    const longitudeText = row.Xlong?.trim() ?? ""
    const latitudeText = row.Ylat?.trim() ?? ""
    const longitude = Number(longitudeText)
    const latitude = Number(latitudeText)

    if (!name || state !== "NY") {
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

    let connectedIds: string[] = []
    try {
      const parsedConnections: unknown = JSON.parse(row.Connections || "[]")
      if (Array.isArray(parsedConnections)) {
        connectedIds = parsedConnections.filter(
          (connection): connection is string => typeof connection === "string",
        )
      }
    } catch {
      connectedIds = []
    }

    group.customers.push({
      id: `customer-${rowIndex}`,
      name,
      addressLine1: row["Address Line 1"]?.trim() ?? "",
      addressLine2: row["Address Line 2"]?.trim() ?? "",
      connectedAssetNames: connectedIds.flatMap((connectedId) => {
        const assetName = assetNames.get(connectedId)
        return assetName ? [assetName] : []
      }),
    })
  }

  return {
    locations: [...groups.values()],
    categories: [...categoryPrograms.entries()]
      .map(([name, programs]) => ({ name, programs }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    regions: [...regionPrograms.entries()]
      .map(([name, programs]) => ({ name, programs }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}