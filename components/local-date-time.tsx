"use client"

import { useSyncExternalStore } from "react"

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
  year: "numeric",
})
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})

const subscribe = () => () => {}

export function LocalDateTime({ value }: { value: string }) {
  // The server can't know the viewer's timezone, so format only on the client.
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return value

  return (
    <time dateTime={date.toISOString()} title={date.toISOString()}>
      {isClient
        ? `${dateFormatter.format(date)} ${timeFormatter.format(date)}`
        : null}
    </time>
  )
}
