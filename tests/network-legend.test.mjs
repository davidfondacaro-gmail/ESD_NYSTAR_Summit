import assert from "node:assert/strict"
import test from "node:test"
import { CUSTOMER_LEGEND_FILTER, filterLegendLocations } from "../lib/network-legend.ts"

const locations = [
  {
    latitude: 42,
    longitude: -74,
    assets: [
      { id: "a", category: "CAT" },
      { id: "b", category: "MEP" },
    ],
    customers: [
      { id: "existing", connections: [{ assetId: "a", connectionType: "Existing" }] },
      { id: "other", connections: [{ assetId: "b", connectionType: "Existing" }] },
    ],
  },
  {
    latitude: 43,
    longitude: -75,
    assets: [],
    customers: [
      { id: "desired", connections: [{ assetId: "a", connectionType: "Desired" }] },
      { id: "unconnected", connections: [] },
    ],
  },
]

test("category filtering retains matching co-located programs and connected partners", () => {
  const original = structuredClone(locations)
  const result = filterLegendLocations(locations, "CAT")
  assert.deepEqual(result[0].assets.map((asset) => asset.id), ["a"])
  assert.deepEqual(result.flatMap((location) => location.customers.map((c) => c.id)), [
    "existing", "desired",
  ])
  assert.deepEqual(locations, original)
})

test("clearing restores the original dataset and unknown categories show no points", () => {
  assert.equal(filterLegendLocations(locations, null), locations)
  assert.deepEqual(filterLegendLocations(locations, "missing"), [])
  assert.deepEqual(filterLegendLocations([], "CAT"), [])
})

test("customer filtering includes connected and unconnected customers but no programs", () => {
  const original = structuredClone(locations)
  const result = filterLegendLocations(locations, CUSTOMER_LEGEND_FILTER)
  assert.deepEqual(result.flatMap((location) => location.assets), [])
  assert.deepEqual(result.flatMap((location) => location.customers.map((c) => c.id)),
    ["existing", "other", "desired", "unconnected"])
  assert.deepEqual(locations, original)
})

test("customer filtering reveals selected customers' connected programs through extras", () => {
  const result = filterLegendLocations(locations, CUSTOMER_LEGEND_FILTER, {
    assetIds: new Set(["a"]),
    customerIds: new Set(["existing"]),
  })
  assert.deepEqual(result.flatMap((location) => location.assets.map((a) => a.id)), ["a"])
  assert.equal(result.flatMap((location) => location.customers).length, 4)
})

test("extras keep selected points and their connections visible outside the category", () => {
  const result = filterLegendLocations(locations, "MEP", {
    assetIds: new Set(["a"]),
    customerIds: new Set(["unconnected"]),
  })
  assert.deepEqual(result[0].assets.map((asset) => asset.id), ["a", "b"])
  assert.deepEqual(result.flatMap((location) => location.customers.map((c) => c.id)), [
    "other", "unconnected",
  ])
})
