import assert from "node:assert/strict"
import test from "node:test"
import {
  coveredConnectionLength,
  overlapArea,
} from "../lib/map-popup-placement.ts"

const rect = { left: 10, top: 10, right: 30, bottom: 30 }

test("measures legend overlap and allows touching edges", () => {
  assert.equal(
    overlapArea(rect, { left: 20, top: 20, right: 40, bottom: 40 }),
    100
  )
  assert.equal(
    overlapArea(rect, { left: 30, top: 10, right: 40, bottom: 20 }),
    0
  )
})

test("measures horizontal, vertical, and diagonal connection coverage", () => {
  assert.equal(
    coveredConnectionLength(rect, {
      from: { x: 0, y: 20 },
      to: { x: 40, y: 20 },
    }),
    20
  )
  assert.equal(
    coveredConnectionLength(rect, {
      from: { x: 20, y: 40 },
      to: { x: 20, y: 0 },
    }),
    20
  )
  assert.equal(
    coveredConnectionLength(rect, {
      from: { x: 0, y: 0 },
      to: { x: 40, y: 40 },
    }),
    Math.hypot(20, 20)
  )
})

test("does not mistake a diagonal bounding-box overlap for a line intersection", () => {
  assert.ok(
    Math.abs(
      coveredConnectionLength(rect, {
        from: { x: 0, y: 22 },
        to: { x: 22, y: 0 },
      }) - Math.hypot(2, 2)
    ) < 1e-10
  )
  assert.equal(
    coveredConnectionLength(rect, {
      from: { x: 0, y: 15 },
      to: { x: 15, y: 0 },
    }),
    0
  )
})

test("handles contained, zero-length, and nonintersecting segments", () => {
  assert.equal(
    coveredConnectionLength(rect, {
      from: { x: 12, y: 12 },
      to: { x: 18, y: 20 },
    }),
    10
  )
  assert.equal(
    coveredConnectionLength(rect, {
      from: { x: 20, y: 20 },
      to: { x: 20, y: 20 },
    }),
    0
  )
  assert.equal(
    coveredConnectionLength(rect, {
      from: { x: 0, y: 0 },
      to: { x: 0, y: 40 },
    }),
    0
  )
})
