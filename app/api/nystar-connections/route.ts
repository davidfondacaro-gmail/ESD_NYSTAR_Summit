import "server-only"

import { randomUUID } from "node:crypto"
import { appendFile, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import Papa from "papaparse"

export const runtime = "nodejs"

const dataDirectory = join(process.cwd(), "public", "data")
const nystarCsvPath = join(
  dataDirectory,
  "nystar-innovation-assets-map-base-layer-lgw.csv"
)
const connectionsCsvPath = join(dataDirectory, "nystar-nystar-connections.csv")
const connectionHeaders = [
  "Connection ID",
  "NYSTAR Asset ID 1",
  "NYSTAR Asset ID 2",
  "Organization Name",
  "NYSTAR Program Name",
  "NYSTAR Host Organization",
  "Connection Type",
  "Added",
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

let writeQueue: Promise<void> = Promise.resolve()

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

async function appendConnection(row: string[]) {
  const operation = writeQueue.then(async () => {
    let csv: string | null = null
    try {
      csv = await readFile(connectionsCsvPath, "utf8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }

    if (csv === null || csv.trim() === "") {
      await writeFile(
        connectionsCsvPath,
        `${Papa.unparse([connectionHeaders, row], { newline: "\n" })}\n`,
        "utf8"
      )
      return
    }

    const parsed = Papa.parse<string[]>(csv, {
      header: false,
      skipEmptyLines: true,
    })
    const currentHeaders = parsed.data[0]?.map((value) => String(value).trim())
    if (JSON.stringify(currentHeaders) !== JSON.stringify(connectionHeaders)) {
      throw new Error("CSV headers do not match the expected schema.")
    }

    const newline = csv.includes("\r\n") ? "\r\n" : "\n"
    const separator = csv.endsWith("\n") ? "" : newline
    await appendFile(
      connectionsCsvPath,
      `${separator}${Papa.unparse([row], { header: false, newline })}${newline}`,
      "utf8"
    )
  })

  writeQueue = operation.then(
    () => {},
    () => {}
  )
  return operation
}

export async function POST(request: Request) {
  let body: Record<string, unknown>

  try {
    const payload: unknown = await request.json()
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return errorResponse("Invalid request body.", 400)
    }
    body = payload as Record<string, unknown>
  } catch {
    return errorResponse("Invalid JSON request body.", 400)
  }

  const assetId1 = text(body.assetId1)
  const assetId2 = text(body.assetId2)
  const connectionType = body.connectionType

  if (!assetId1 || !assetId2) {
    return errorResponse("Select two NYSTAR programs.", 400)
  }
  if (assetId1 === assetId2) {
    return errorResponse("Select two different NYSTAR programs.", 400)
  }
  if (connectionType !== "Existing" && connectionType !== "Desired") {
    return errorResponse("Select a connection status.", 400)
  }

  const isDesired = connectionType === "Desired"
  const followupName = isDesired ? text(body.followupName) : ""
  const followupEmail = isDesired ? text(body.followupEmail) : ""
  const followupPhone = isDesired ? text(body.followupPhone) : ""
  const followupComments = isDesired ? text(body.followupComments) : ""
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
    const asset1 = assetsById.get(assetId1)
    const asset2 = assetsById.get(assetId2)
    if (!asset1 || !asset2) {
      return errorResponse("One or more NYSTAR programs are invalid.", 400)
    }

    const connectionId = `CON-${randomUUID()}`
    await appendConnection([
      connectionId,
      assetId1,
      assetId2,
      asset1["Asset / Program Name"].trim(),
      asset2["Asset / Program Name"].trim(),
      asset2["Host Organization"]?.trim() ?? "",
      connectionType,
      new Date().toISOString(),
      followupName,
      followupEmail,
      followupPhone,
      followupComments,
    ])

    return Response.json({ saved: true, connectionId }, { status: 201 })
  } catch (error) {
    console.error("Failed to save NYSTAR connection", error)
    return errorResponse("Unable to save the connection.", 500)
  }
}
