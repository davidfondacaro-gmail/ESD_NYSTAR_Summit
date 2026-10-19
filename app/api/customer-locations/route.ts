import "server-only"

import { randomUUID } from "node:crypto"
import { appendFile, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import Papa from "papaparse"
import { revalidatePath } from "next/cache"
import zipcodes from "zipcodes"

import { regionForPoint } from "@/lib/nystar-regions"
import { normalizeOrganizationName } from "@/lib/organization-name"

export const runtime = "nodejs"

const dataDirectory = join(process.cwd(), "public", "data")
const nystarCsvPath = join(
  dataDirectory,
  "nystar-innovation-assets-map-base-layer-lgw.csv"
)
const customerCsvPath = join(dataDirectory, "customer-locations.csv")
const regionsPath = join(dataDirectory, "ny_mep_regions.geojson")
const connectionsCsvPath = join(
  dataDirectory,
  "nystar-customer-connections.csv"
)
const customerHeaders = [
  "Customer ID",
  "Region",
  "Organization Name",
  "Address Line 1",
  "Address Line 2",
  "City",
  "State",
  "ZIP Code",
  "Address Confidence",
  "Address Verification Note",
  "Xlong",
  "Ylat",
  "Added",
]
const connectionHeaders = [
  "Connection ID",
  "Customer ID",
  "NYSTAR Asset ID",
  "Organization Name",
  "NYSTAR Program Name",
  "NYSTAR Host Organization",
  "Connection Type",
  "Created At",
  "Followup Name",
  "Followup Email",
  "Followup Phone",
  "Comments",
]

type NystarCsvRow = {
  ID: string
  "Asset / Program Name": string
  "Host Organization": string
}

type ConnectionType = "Existing" | "Desired"

type CustomerRequest = {
  existingPartnerName?: unknown
  organizationName?: unknown
  addressLine1?: unknown
  addressLine2?: unknown
  city?: unknown
  state?: unknown
  postalCode?: unknown
  followupName?: unknown
  followupEmail?: unknown
  followupPhone?: unknown
  followupComments?: unknown
  connections?: unknown
}

let writeQueue: Promise<void> = Promise.resolve()

class DuplicateOrganizationError extends Error {}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

function getAppendText(
  csv: string,
  expectedHeaders: string[],
  rows: string[][]
) {
  const parsed = Papa.parse<string[]>(csv, {
    header: false,
    skipEmptyLines: true,
  })
  const currentHeaders = parsed.data[0]?.map((value) => String(value).trim())

  if (JSON.stringify(currentHeaders) !== JSON.stringify(expectedHeaders)) {
    throw new Error("CSV headers do not match the expected schema.")
  }

  const newline = csv.includes("\r\n") ? "\r\n" : "\n"
  const separator = csv.endsWith("\n") ? "" : newline
  return `${separator}${Papa.unparse(rows, { header: false, newline })}${newline}`
}

async function appendConnectionsForExistingCustomer(
  organizationName: string,
  connectionValues: string[][]
) {
  const operation = writeQueue.then(async () => {
    const [customerCsv, connectionsCsv] = await Promise.all([
      readFile(customerCsvPath, "utf8"),
      readFile(connectionsCsvPath, "utf8"),
    ])
    const parsed = Papa.parse<Record<string, string>>(customerCsv, {
      header: true,
      skipEmptyLines: true,
    })
    if (parsed.errors.length > 0) {
      throw new Error("Unable to parse customer IDs from CSV.")
    }
    const customer = parsed.data.find(
      (row) =>
        normalizeOrganizationName(row["Organization Name"] ?? "") ===
        normalizeOrganizationName(organizationName)
    )
    const customerId = customer?.["Customer ID"]?.trim()
    if (!customerId) return null
    for (const connection of connectionValues) {
      connection[1] = customerId
    }
    await appendFile(
      connectionsCsvPath,
      getAppendText(connectionsCsv, connectionHeaders, connectionValues),
      "utf8"
    )
    return customerId
  })

  writeQueue = operation.then(
    () => {},
    () => {}
  )
  return operation
}

async function appendCustomerAndConnections(
  customerValues: string[],
  connectionValues: string[][]
) {
  const operation = writeQueue.then(async () => {
    const [customerCsv, connectionsCsv] = await Promise.all([
      readFile(customerCsvPath, "utf8"),
      readFile(connectionsCsvPath, "utf8"),
    ])
    const newName = normalizeOrganizationName(customerValues[2])
    const customerRows = Papa.parse<Record<string, string>>(customerCsv, {
      header: true,
      skipEmptyLines: true,
    }).data
    if (
      customerRows.some(
        (row) =>
          normalizeOrganizationName(row["Organization Name"] ?? "") === newName
      )
    ) {
      throw new DuplicateOrganizationError()
    }
    let highestCustomerNumber = 0
    for (const csv of [customerCsv, connectionsCsv]) {
      const parsed = Papa.parse<Record<string, string>>(csv, {
        header: true,
        skipEmptyLines: true,
      })
      if (parsed.errors.length > 0) {
        throw new Error("Unable to parse customer IDs from CSV.")
      }
      for (const row of parsed.data) {
        const match = /^CUS-(\d+)$/.exec(row["Customer ID"]?.trim() ?? "")
        if (match) {
          const customerNumber = Number(match[1])
          if (!Number.isSafeInteger(customerNumber)) {
            throw new Error("Customer ID exceeds the supported numeric range.")
          }
          highestCustomerNumber = Math.max(
            highestCustomerNumber,
            customerNumber
          )
        }
      }
    }
    const nextCustomerNumber = highestCustomerNumber + 1
    if (!Number.isSafeInteger(nextCustomerNumber)) {
      throw new Error("Customer ID exceeds the supported numeric range.")
    }
    const customerId = `CUS-${String(nextCustomerNumber).padStart(3, "0")}`
    customerValues[0] = customerId
    for (const connection of connectionValues) {
      connection[1] = customerId
    }
    const customerAppend = getAppendText(customerCsv, customerHeaders, [
      customerValues,
    ])
    const connectionsAppend = getAppendText(
      connectionsCsv,
      connectionHeaders,
      connectionValues
    )

    try {
      await appendFile(customerCsvPath, customerAppend, "utf8")
      await appendFile(connectionsCsvPath, connectionsAppend, "utf8")
    } catch (error) {
      await Promise.all([
        writeFile(customerCsvPath, customerCsv, "utf8"),
        writeFile(connectionsCsvPath, connectionsCsv, "utf8"),
      ])
      throw error
    }
    return customerId
  })

  writeQueue = operation.then(
    () => {},
    () => {}
  )
  return operation
}

export async function POST(request: Request) {
  let body: CustomerRequest

  try {
    const payload: unknown = await request.json()
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return errorResponse("Invalid request body.", 400)
    }
    body = payload as CustomerRequest
  } catch {
    return errorResponse("Invalid JSON request body.", 400)
  }

  const existingPartnerName = text(body.existingPartnerName)
  const organizationName = existingPartnerName || text(body.organizationName)
  const addressLine1 = text(body.addressLine1)
  const addressLine2 = text(body.addressLine2)
  const city = text(body.city)
  const postalCode = text(body.postalCode)

  const coordinates = existingPartnerName ? null : zipcodes.lookup(postalCode)
  if (!existingPartnerName) {
    if (!organizationName || !addressLine1 || !city || !postalCode) {
      return errorResponse(
        "Organization, street address, city, and ZIP code are required.",
        400
      )
    }
    if (body.state !== "NY") {
      return errorResponse("Only New York addresses are allowed.", 400)
    }
    if (!/^\d{5}$/.test(postalCode)) {
      return errorResponse("Enter a valid five-digit ZIP code.", 400)
    }
    if (!coordinates || coordinates.state !== "NY") {
      return errorResponse("Enter a New York ZIP code.", 400)
    }
  }

  if (!Array.isArray(body.connections) || body.connections.length === 0) {
    return errorResponse("Select at least one NYSTAR location.", 400)
  }

  const requestedConnections: {
    assetId: string
    connectionType: ConnectionType
  }[] = []
  const seenAssetIds = new Set<string>()
  for (const item of body.connections) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return errorResponse("Invalid NYSTAR connection.", 400)
    }
    const connection = item as Record<string, unknown>
    const assetId = text(connection.assetId)
    const connectionType = connection.connectionType
    if (
      !assetId ||
      (connectionType !== "Existing" && connectionType !== "Desired") ||
      seenAssetIds.has(assetId)
    ) {
      return errorResponse(
        "Each selected asset needs one Existing or Desired type.",
        400
      )
    }
    seenAssetIds.add(assetId)
    requestedConnections.push({ assetId, connectionType })
  }

  const followupName = text(body.followupName)
  const followupEmail = text(body.followupEmail)
  const followupPhone = text(body.followupPhone)
  const followupComments = text(body.followupComments)
  if (followupEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(followupEmail)) {
    return errorResponse("Enter a valid follow-up email address.", 400)
  }

  try {
    const nystarCsv = await readFile(nystarCsvPath, "utf8")
    const { data: nystarRows } = Papa.parse<NystarCsvRow>(nystarCsv, {
      header: true,
      skipEmptyLines: true,
    })
    const assetsById = new Map(
      nystarRows
        .filter((row) => row.ID?.trim() && row["Asset / Program Name"]?.trim())
        .map((row) => [row.ID.trim(), row])
    )

    if (requestedConnections.some(({ assetId }) => !assetsById.has(assetId))) {
      return errorResponse(
        "One or more selected NYSTAR locations are invalid.",
        400
      )
    }

    const createdAt = new Date().toISOString()
    const connectionIds = requestedConnections.map(() => `CON-${randomUUID()}`)
    const connectionRows = requestedConnections.map((connection, index) => {
      const asset = assetsById.get(connection.assetId)!
      return [
        connectionIds[index],
        "",
        connection.assetId,
        organizationName,
        asset["Asset / Program Name"].trim(),
        asset["Host Organization"]?.trim() ?? "",
        connection.connectionType,
        createdAt,
        connection.connectionType === "Desired" ? followupName : "",
        connection.connectionType === "Desired" ? followupEmail : "",
        connection.connectionType === "Desired" ? followupPhone : "",
        connection.connectionType === "Desired" ? followupComments : "",
      ]
    })

    if (existingPartnerName) {
      const customerId = await appendConnectionsForExistingCustomer(
        existingPartnerName,
        connectionRows
      )
      if (!customerId) {
        return errorResponse("The selected partner could not be found.", 404)
      }
      revalidatePath("/")
      return Response.json(
        { saved: true, customerId, connectionIds },
        { status: 201 }
      )
    }

    if (!coordinates) {
      return errorResponse("Enter a New York ZIP code.", 400)
    }
    const regionsText = await readFile(regionsPath, "utf8")
    const region = regionForPoint(coordinates, JSON.parse(regionsText))
    const customerId = await appendCustomerAndConnections(
      [
        "",
        region,
        organizationName,
        addressLine1,
        addressLine2,
        city,
        "NY",
        postalCode,
        "Low",
        "User-entered address; ZIP-centroid coordinates are approximate and the address is unverified.",
        String(coordinates.longitude),
        String(coordinates.latitude),
        createdAt,
      ],
      connectionRows
    )

    revalidatePath("/")
    return Response.json(
      { saved: true, customerId, connectionIds },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof DuplicateOrganizationError) {
      return errorResponse(
        "An organization with this name already exists.",
        409
      )
    }
    console.error("Failed to save customer location", error)
    return errorResponse("Unable to save the customer location.", 500)
  }
}
