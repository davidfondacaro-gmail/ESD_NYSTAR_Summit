import "server-only"

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import Papa from "papaparse"
import zipcodes from "zipcodes"

export type NystarAsset = {
  name: string
  category: string
  hostOrganization: string
}

export type NystarLocationGroup = {
  latitude: number
  longitude: number
  cities: string[]
  zipCodes: string[]
  assets: NystarAsset[]
}

type NystarCsvRow = {
  "NYSTAR Program Category": string
  "Asset / Program Name": string
  "Host Organization": string
  City: string
  State: string
  "ZIP Code": string
}

export async function getNystarLocations(): Promise<NystarLocationGroup[]> {
  const csv = await readFile(
    join(process.cwd(), "public", "data", "nystar-locations.csv"),
    "utf8",
  )
  const { data } = Papa.parse<NystarCsvRow>(csv, {
    header: true,
    skipEmptyLines: true,
  })
  const groups = new Map<string, NystarLocationGroup>()

  for (const row of data) {
    const name = row["Asset / Program Name"]?.trim()
    const city = row.City?.trim()
    const zipCode = row["ZIP Code"]?.trim()

    if (!name || row.State?.trim() !== "NY" || !zipCode || !/^\d{5}$/.test(zipCode)) {
      continue
    }

    const coordinates = zipcodes.lookup(zipCode)

    if (!coordinates || coordinates.state !== "NY") {
      continue
    }

    const key = `${coordinates.latitude},${coordinates.longitude}`
    let group = groups.get(key)

    if (!group) {
      group = {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        cities: [],
        zipCodes: [],
        assets: [],
      }
      groups.set(key, group)
    }

    if (city && !group.cities.includes(city)) {
      group.cities.push(city)
    }
    if (!group.zipCodes.includes(zipCode)) {
      group.zipCodes.push(zipCode)
    }

    group.assets.push({
      name,
      category: row["NYSTAR Program Category"]?.trim() ?? "",
      hostOrganization: row["Host Organization"]?.trim() ?? "",
    })
  }

  return [...groups.values()]
}