"use client"

import { FileDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

function pad(value: number) {
  return String(value).padStart(2, "0")
}

export function timestampedCsvName(file: string, date = new Date()) {
  const base = file.replace(/\.csv$/i, "")
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  return `${base}_${stamp}.csv`
}

export function SaveCsvButton({ csv, file }: { csv: string; file: string }) {
  function save() {
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    )
    const link = document.createElement("a")
    link.href = url
    link.download = timestampedCsvName(file)
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" size="sm" onClick={save}>
      <FileDownIcon data-icon="inline-start" />
      Save CSV
    </Button>
  )
}
