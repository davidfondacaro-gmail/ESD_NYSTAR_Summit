import "server-only"

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import Papa from "papaparse"

import { LocalDateTime } from "@/components/local-date-time"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DATA_TABLES, isDataTableId } from "@/lib/data-tables"

const HIDDEN_COLUMNS = new Set([
  "address confidence",
  "address verification note",
  "xlong",
  "ylat",
  "latitude",
  "longitude",
])
const DATE_TIME_COLUMNS = new Set(["added"])

function isHiddenColumn(column: string) {
  const name = column.trim().toLowerCase()
  return HIDDEN_COLUMNS.has(name) || /\bid\b/.test(name)
}

function isDateTimeColumn(column: string) {
  return DATE_TIME_COLUMNS.has(column.trim().toLowerCase())
}

type DataTablePageProps = {
  params: Promise<{ table: string }>
}

export async function generateMetadata({
  params,
}: DataTablePageProps): Promise<Metadata> {
  const { table } = await params
  return {
    title: isDataTableId(table)
      ? `${DATA_TABLES[table].title} · NYSTAR Innovation Network`
      : "NYSTAR Innovation Network",
  }
}

export default async function DataTablePage({ params }: DataTablePageProps) {
  await connection()
  const { table } = await params
  if (!isDataTableId(table)) notFound()

  const { title, file } = DATA_TABLES[table]
  const csv = await readFile(
    join(process.cwd(), "public", "data", file),
    "utf8"
  )
  const { data, meta } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  })
  const columns = (meta.fields ?? []).filter(
    (column) => !isHiddenColumn(column)
  )

  return (
    <main className="flex min-h-svh flex-col gap-4 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {data.length} {data.length === 1 ? "row" : "rows"} · {file}
        </p>
      </header>
      <div className="rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={Math.max(columns.length, 1)}
                  className="h-24 text-center text-muted-foreground"
                >
                  No rows yet.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column}>
                      {isDateTimeColumn(column) ? (
                        <LocalDateTime value={row[column] ?? ""} />
                      ) : (
                        row[column]
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  )
}
