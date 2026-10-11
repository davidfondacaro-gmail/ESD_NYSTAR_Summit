import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import Papa from "papaparse"
import zipcodes from "zipcodes"

const dataDirectory = join(process.cwd(), "public", "data")
const mapCsvPath = join(
  dataDirectory,
  "nystar-innovation-assets-map-base-layer-lgw.csv"
)
const regionsPath = join(dataDirectory, "ny_mep_regions.geojson")
const writeChanges = process.argv.includes("--write")
const mapFields = [
  "NYSTAR Program Category",
  "Asset / Program Name",
  "Host Organization",
  "Address Line 1",
  "Address Line 2",
  "City",
  "State",
  "ZIP Code",
  "Address Confidence",
  "Address Verification Note",
]

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
}

function containsRing(point, ring) {
  let inside = false

  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentLongitude, currentLatitude] = ring[current]
    const [previousLongitude, previousLatitude] = ring[previous]
    const cross =
      (point.longitude - currentLongitude) *
        (previousLatitude - currentLatitude) -
      (point.latitude - currentLatitude) *
        (previousLongitude - currentLongitude)

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
      (currentLatitude > point.latitude) !==
      (previousLatitude > point.latitude)
    const crossingLongitude =
      ((previousLongitude - currentLongitude) *
        (point.latitude - currentLatitude)) /
        (previousLatitude - currentLatitude) +
      currentLongitude

    if (crossesLatitude && point.longitude < crossingLongitude) {
      inside = !inside
    }
  }

  return inside
}

function containsPolygon(point, polygon) {
  return (
    containsRing(point, polygon[0]) &&
    !polygon.slice(1).some((hole) => containsRing(point, hole))
  )
}

function containsFeature(point, feature) {
  const { geometry } = feature
  if (!geometry) return false
  if (geometry.type === "Polygon") {
    return containsPolygon(point, geometry.coordinates)
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => containsPolygon(point, polygon))
  }
  return false
}

function mapPointForRow(row) {
  const zipCode = String(row["ZIP Code"] ?? "").trim()
  const coordinates = zipcodes.lookup(zipCode)
  if (!coordinates || coordinates.state !== "NY") return null
  return { latitude: coordinates.latitude, longitude: coordinates.longitude }
}

function regionForPoint(point, features) {
  if (!point) return "Unassigned"
  const geoJsonPoint = {
    latitude: point.latitude,
    longitude: point.longitude,
  }
  return (
    features.find((feature) => containsFeature(geoJsonPoint, feature))?.properties
      ?.region_name ?? "Unassigned"
  )
}

function generatedId(row, occurrences) {
  const identity = [
    row["NYSTAR Program Category"],
    row["Asset / Program Name"],
    row["Host Organization"],
    row["Address Line 1"],
    row["Address Line 2"],
    row.City,
    row.State,
    row["ZIP Code"],
  ]
    .map(normalize)
    .join("\u001f")
  const hash = createHash("sha256").update(identity).digest("hex").slice(0, 12)
  const occurrence = (occurrences.get(hash) ?? 0) + 1
  occurrences.set(hash, occurrence)
  return `NYSTAR-MAP-${hash.toUpperCase()}${occurrence > 1 ? `-${occurrence}` : ""}`
}

async function main() {
  const [mapCsv, geoJsonText] = await Promise.all([
    readFile(mapCsvPath, "utf8"),
    readFile(regionsPath, "utf8"),
  ])
  const parsedMatrix = Papa.parse(mapCsv, {
    header: false,
    skipEmptyLines: true,
  }).data
  const hasEnrichmentColumns =
    parsedMatrix[0]?.[0] === "ID" && parsedMatrix[0]?.[1] === "Region"
  const sourceHeader = hasEnrichmentColumns
    ? parsedMatrix[0].slice(2)
    : parsedMatrix[0]
  const sourceRows = parsedMatrix.slice(1).map((rawRow) => {
    const values = hasEnrichmentColumns ? rawRow.slice(2) : rawRow
    return Object.fromEntries(
      [
        ["existingId", hasEnrichmentColumns ? rawRow[0]?.trim() ?? "" : ""],
        ...mapFields.map((field) => [
          field,
          values[sourceHeader.indexOf(field)] ?? "",
        ]),
      ]
    )
  })
  const geoJson = JSON.parse(geoJsonText)
  const mapRows = sourceRows.filter((row) =>
    row["Asset / Program Name"]?.trim()
  )

  if (parsedMatrix.length !== mapRows.length + 1) {
    throw new Error("CSV row alignment check failed; refusing to rewrite the source file.")
  }

  const existingIdCounts = new Map()
  for (const row of mapRows) {
    if (row.existingId) {
      existingIdCounts.set(
        row.existingId,
        (existingIdCounts.get(row.existingId) ?? 0) + 1
      )
    }
  }
  const assignedIds = new Set()
  const idOccurrences = new Map()
  const summary = {
    total: mapRows.length,
    preservedIds: 0,
    generatedIds: 0,
    unassignedRegions: 0,
    regionCounts: {},
    unmatchedRecords: [],
  }
  const enrichedByRow = new Map()

  for (const row of mapRows) {
    let id = row.existingId
    if (
      id &&
      existingIdCounts.get(id) === 1 &&
      !assignedIds.has(id)
    ) {
      summary.preservedIds += 1
    } else {
      id = generatedId(row, idOccurrences)
      while (assignedIds.has(id)) {
        id = generatedId(row, idOccurrences)
      }
      summary.generatedIds += 1
      summary.unmatchedRecords.push({
        category: row["NYSTAR Program Category"],
        name: row["Asset / Program Name"],
        host: row["Host Organization"],
        id,
      })
    }
    assignedIds.add(id)

    const point = mapPointForRow(row)
    const region = regionForPoint(point, geoJson.features ?? [])
    if (region === "Unassigned") summary.unassignedRegions += 1
    summary.regionCounts[region] = (summary.regionCounts[region] ?? 0) + 1
    enrichedByRow.set(row, { id, region })
  }

  const outputRows = [["ID", "Region", ...mapFields]]
  for (let index = 0; index < mapRows.length; index += 1) {
    const row = mapRows[index]
    const enriched = enrichedByRow.get(row)
    outputRows.push([
      enriched.id,
      enriched.region,
      ...mapFields.map((field) => row[field] ?? ""),
    ])
  }

  console.log(JSON.stringify(summary, null, 2))
  if (writeChanges) {
    const newline = mapCsv.includes("\r\n") ? "\r\n" : "\n"
    await writeFile(
      mapCsvPath,
      `${Papa.unparse(outputRows, { header: false, newline })}${newline}`,
      "utf8"
    )
    console.log(`Updated ${mapCsvPath}`)
  } else {
    console.log("Dry run only. Pass --write to update the map CSV.")
  }
}

await main()
