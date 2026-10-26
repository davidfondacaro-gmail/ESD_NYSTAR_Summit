import assert from "node:assert/strict"
import test from "node:test"
import { calloutAnchor, layoutPointLabels } from "../lib/map-point-labels.ts"

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

test("places an isolated label beside its point without a callout", () => {
  const [label] = layoutPointLabels([{ id: "a", x: 100, y: 100, width: 60, height: 12 }])
  assert.equal(label.callout, false)
  assert.ok(label.x > 100)
})

test("keeps crowded labels from overlapping each other or any marker", () => {
  const points = Array.from({ length: 10 }, (_, index) => ({
    id: String(index),
    x: 200 + (index % 4) * 8,
    y: 200 + Math.floor(index / 4) * 8,
    width: 90,
    height: 12,
  }))
  const labels = layoutPointLabels(points)
  for (const [index, label] of labels.entries()) {
    for (const other of labels.slice(index + 1)) assert.equal(overlaps(label, other), false)
    for (const point of points) {
      assert.equal(overlaps(label, { x: point.x - 10, y: point.y - 10, width: 20, height: 20 }), false)
    }
  }
  assert.ok(labels.some((label) => label.callout))
})

test("never places a label over a hard obstacle when there is room elsewhere", () => {
  const obstacle = { left: 110, top: 50, right: 300, bottom: 150 }
  const [label] = layoutPointLabels(
    [{ id: "a", x: 100, y: 100, width: 60, height: 12 }],
    undefined,
    { hard: [obstacle] }
  )
  assert.equal(overlaps(label, { x: 110, y: 50, width: 190, height: 100 }), false)
})

test("callout anchors sit on the label edge nearest the point", () => {
  const anchor = calloutAnchor({ id: "a", x: 50, y: 0, width: 40, height: 10, pointX: 0, pointY: 5, callout: true })
  assert.deepEqual(anchor, { x: 50, y: 5 })
})
