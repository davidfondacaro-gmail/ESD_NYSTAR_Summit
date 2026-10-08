import "server-only"

import { appendFile, readFile } from "node:fs/promises"
import { join } from "node:path"

import Papa from "papaparse"
import { revalidatePath } from "next/cache"
import zipcodes from "zipcodes"

export const runtime = "nodejs"

const dataDirectory = join(process.cwd(), "public", "data")
const nystarCsvPath = join(dataDirectory, "nystar-locations.csv")
const customerCsvPath = join(dataDirectory, "customer-locations.csv")
const customerHeaders = [
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
  "Connections",
]

type NystarCsvRow = {
  ID: string
  "Asset / Program Name": string
}

type CustomerRequest = {
  organizationName?: unknown
  addressLine1?: unknown
  addressLine2?: unknown
  city?: unknown
  state?: unknown
  postalCode?: unknown
  connectedAssetIds?: unknown
}

let writeQueue: Promise<void> = Promise.resolve()

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

async function appendCustomerRow(values: string[]) {
  const operation = writeQueue.then(async () => {
    const csv = await readFile(customerCsvPath, "utf8")
    const parsed = Papa.parse<string[]>(csv, {
      header: false,
      skipEmptyLines: true,
    })
    const currentHeaders = parsed.data[0]?.map((value) => String(value).trim())

    if (JSON.stringify(currentHeaders) !== JSON.stringify(customerHeaders)) {
      throw new Error("Customer CSV headers do not match the expected schema.")
    }

    const newline = csv.includes("\r\n") ? "\r\n" : "\n"
    const separator = csv.endsWith("\n") ? "" : newline
    const row = Papa.unparse([values], { header: false, newline })

    await appendFile(customerCsvPath, `${separator}${row}${newline}`, "utf8")
  })

  writeQueue = operation.catch(() => {})
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

  const organizationName = text(body.organizationName)
  const addressLine1 = text(body.addressLine1)
  const addressLine2 = text(body.addressLine2)
  const city = text(body.city)
  const postalCode = text(body.postalCode)

  if (!organizationName || !addressLine1 || !city || !postalCode) {
    return errorResponse("Organization, street address, city, and ZIP code are required.", 400)
  }
  if (body.state !== "NY") {
    return errorResponse("Only New York addresses are allowed.", 400)
  }
  if (!/^\d{5}$/.test(postalCode)) {
    return errorResponse("Enter a valid five-digit ZIP code.", 400)
  }

  const coordinates = zipcodes.lookup(postalCode)
  if (!coordinates || coordinates.state !== "NY") {
    return errorResponse("Enter a New York ZIP code.", 400)
  }

  const connectedAssetIds = Array.isArray(body.connectedAssetIds)
    ? [...new Set(body.connectedAssetIds.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean))]
    : []

  if (connectedAssetIds.length === 0) {
    return errorResponse("Select at least one NYSTAR location.", 400)
  }

  try {
    const nystarCsv = await readFile(nystarCsvPath, "utf8")
    const { data: nystarRows } = Papa.parse<NystarCsvRow>(nystarCsv, {
      header: true,
      skipEmptyLines: true,
    })
    const validAssetIds = new Set(
      nystarRows
        .filter((row) => row["Asset / Program Name"]?.trim())
        .map((row) => row.ID?.trim())
        .filter(Boolean),
    )

    if (connectedAssetIds.some((id) => !validAssetIds.has(id))) {
      return errorResponse("One or more selected NYSTAR locations are invalid.", 400)
    }

    await appendCustomerRow([
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
      JSON.stringify(connectedAssetIds),
    ])

    revalidatePath("/")
    return Response.json({ saved: true }, { status: 201 })
  } catch (error) {
    console.error("Failed to save customer location", error)
    return errorResponse("Unable to save the customer location.", 500)
  }
}