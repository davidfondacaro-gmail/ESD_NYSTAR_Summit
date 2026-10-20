export const DATA_TABLES = {
  "nystar-customer-connections": {
    title: "NYSTAR-Customer Connections",
    file: "nystar-customer-connections.csv",
  },
  "nystar-nystar-connections": {
    title: "NYSTAR-NYSTAR Connections",
    file: "nystar-nystar-connections.csv",
  },
  "innovation-partners": {
    title: "Innovation Partners",
    file: "customer-locations.csv",
  },
} as const

export type DataTableId = keyof typeof DATA_TABLES

export function isDataTableId(value: string): value is DataTableId {
  return Object.hasOwn(DATA_TABLES, value)
}
