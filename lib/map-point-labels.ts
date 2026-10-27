export type LabelPoint = {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export type PlacedLabel = {
  id: string
  x: number
  y: number
  width: number
  height: number
  pointX: number
  pointY: number
  callout: boolean
}

export type Box = { left: number; top: number; right: number; bottom: number }

export type LabelObstacles = {
  // Areas labels must never cover, such as map overlays.
  hard?: Box[]
  // Areas labels should avoid when there is room, such as region names.
  soft?: Box[]
}

const MARKER_RADIUS = 10
const LABEL_GAP = 4
const CALLOUT_STEP = 26
const CALLOUT_RINGS = 6
// Right, left, above, below, then the diagonals.
const DIRECTIONS: [number, number][] = [
  [1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1],
]

function overlaps(a: Box, b: Box) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

type Segment = { x1: number; y1: number; x2: number; y2: number }

// Liang-Barsky clipping: does the segment pass through the box?
function segmentHitsBox(segment: Segment, box: Box) {
  const dx = segment.x2 - segment.x1
  const dy = segment.y2 - segment.y1
  let enter = 0
  let exit = 1
  for (const [p, q] of [
    [-dx, segment.x1 - box.left], [dx, box.right - segment.x1],
    [-dy, segment.y1 - box.top], [dy, box.bottom - segment.y1],
  ]) {
    if (p === 0) {
      if (q < 0) return false
      continue
    }
    const t = q / p
    if (p < 0) enter = Math.max(enter, t)
    else exit = Math.min(exit, t)
    if (enter > exit) return false
  }
  return true
}

function segmentsCross(a: Segment, b: Segment) {
  const cross = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
    (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
  const d1 = cross(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1)
  const d2 = cross(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2)
  const d3 = cross(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1)
  const d4 = cross(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2)
  return d1 * d2 < 0 && d3 * d4 < 0
}

function anchorOnBox(x: number, y: number, box: Box) {
  return {
    x: Math.min(Math.max(x, box.left), box.right),
    y: Math.min(Math.max(y, box.top), box.bottom),
  }
}

function labelBox(point: LabelPoint, dx: number, dy: number, distance: number): Box {
  const reach = MARKER_RADIUS + LABEL_GAP + distance
  const left = dx > 0
    ? point.x + reach
    : dx < 0
    ? point.x - reach - point.width
    : point.x - point.width / 2
  const top = dy > 0
    ? point.y + reach
    : dy < 0
    ? point.y - reach - point.height
    : point.y - point.height / 2
  return { left, top, right: left + point.width, bottom: top + point.height }
}

// Greedy label placement in screen space: try spots beside each point first, then
// progressively farther spots (drawn with a callout line) until one is free.
export function layoutPointLabels(
  points: LabelPoint[],
  bounds?: Box,
  obstacles: LabelObstacles = {}
): PlacedLabel[] {
  const hard = obstacles.hard ?? []
  const soft = obstacles.soft ?? []
  const markers: Box[] = points.map((point) => ({
    left: point.x - MARKER_RADIUS,
    top: point.y - MARKER_RADIUS,
    right: point.x + MARKER_RADIUS,
    bottom: point.y + MARKER_RADIUS,
  }))
  const crowding = points.map((point) =>
    points.filter((other) => Math.hypot(other.x - point.x, other.y - point.y) < 120).length
  )
  const order = points
    .map((point, index) => ({ point, index }))
    .sort((a, b) => crowding[b.index] - crowding[a.index] || a.point.y - b.point.y || a.point.x - b.point.x)
  const placed: Box[] = []
  const callouts: Segment[] = []
  const results = new Map<string, PlacedLabel>()

  for (const { point, index } of order) {
    let best: { box: Box; ring: number; score: number; callout: Segment | null } | null = null
    // Every candidate's score is at least its ring, so stop once no farther ring can win.
    for (let ring = 0; ring <= CALLOUT_RINGS && !(best && best.score <= ring); ring++) {
      for (const [dx, dy] of DIRECTIONS) {
        const box = labelBox(point, dx, dy, ring * CALLOUT_STEP)
        const anchor = anchorOnBox(point.x, point.y, box)
        const callout = ring > 0 ? { x1: point.x, y1: point.y, x2: anchor.x, y2: anchor.y } : null
        const collisions =
          placed.filter((other) => overlaps(box, other)).length +
          markers.filter((other) => overlaps(box, other)).length +
          hard.filter((other) => overlaps(box, other)).length
        const softCollisions = soft.filter((other) => overlaps(box, other)).length
        const lineConflicts =
          callouts.filter((other) => segmentHitsBox(other, box)).length +
          (callout
            ? placed.filter((other) => segmentHitsBox(callout, other)).length +
              markers.filter((other, markerIndex) => markerIndex !== index && segmentHitsBox(callout, other)).length +
              callouts.filter((other) => segmentsCross(callout, other)).length
            : 0)
        const outside = bounds && (
          box.left < bounds.left || box.right > bounds.right ||
          box.top < bounds.top || box.bottom > bounds.bottom
        )
        const score = collisions * 100 + (outside ? 50 : 0) + lineConflicts * 4 + softCollisions * 1.5 + ring
        if (!best || score < best.score) best = { box, ring, score, callout }
        if (score === ring) break
      }
    }
    const result = best!
    placed.push(result.box)
    if (result.callout) callouts.push(result.callout)
    results.set(point.id, {
      id: point.id,
      x: result.box.left,
      y: result.box.top,
      width: point.width,
      height: point.height,
      pointX: point.x,
      pointY: point.y,
      callout: result.ring > 0,
    })
  }
  return points.map((point) => results.get(point.id)!)
}

// Where a callout line from the point should meet the label's edge.
export function calloutAnchor(label: PlacedLabel) {
  return anchorOnBox(label.pointX, label.pointY, {
    left: label.x,
    top: label.y,
    right: label.x + label.width,
    bottom: label.y + label.height,
  })
}
