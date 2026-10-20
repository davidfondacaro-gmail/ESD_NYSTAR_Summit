import assert from "node:assert/strict"
import test from "node:test"
import {
  buildTourStops,
  nextTourIndex,
  scopedTourStops,
  TOUR_DWELL_MS,
} from "../lib/network-tour.ts"

const regions = [
  {
    name: "Western",
    programs: [
      { id: "3", name: "Zeta" },
      { id: "4", name: "Alpha" },
    ],
  },
  { name: "Empty", programs: [{ id: "unmapped", name: "Not on map" }] },
  {
    name: "Capital",
    programs: [
      { id: "2", name: "Beta" },
      { id: "1", name: "Alpha" },
      { id: "1", name: "Alpha" },
    ],
  },
]
const locations = [{ assets: ["1", "2", "3", "4"].map((id) => ({ id })) }]

test("sorts regions/assets, excludes unmapped assets, and deduplicates shared IDs", () => {
  const stops = buildTourStops(regions, locations)
  assert.deepEqual(
    stops.map((s) => [s.region, s.assetId]),
    [
      ["Capital", "1"],
      ["Capital", "2"],
      ["Western", "4"],
      ["Western", "3"],
    ]
  )
})

test("All Regions crosses region boundaries and loops", () => {
  const stops = scopedTourStops(buildTourStops(regions, locations), "all")
  assert.equal(stops[nextTourIndex(1, stops.length)].region, "Western")
  assert.equal(stops[nextTourIndex(3, stops.length)].assetId, "1")
})

test("regional scope loops without leaving the region", () => {
  const stops = scopedTourStops(buildTourStops(regions, locations), "Western")
  assert.equal(stops.length, 2)
  assert.equal(stops[nextTourIndex(1, stops.length)].assetId, "4")
})

test("handles empty and singleton tours and fixes dwell at eight seconds", () => {
  assert.deepEqual(
    scopedTourStops(buildTourStops(regions, locations), "Empty"),
    []
  )
  assert.deepEqual(buildTourStops([], []), [])
  assert.equal(nextTourIndex(0, 0), 0)
  assert.equal(nextTourIndex(0, 1), 0)
  assert.equal(TOUR_DWELL_MS, 8000)
})
