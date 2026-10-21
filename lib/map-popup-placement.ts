export type PopupRect = {
  left: number
  top: number
  right: number
  bottom: number
}
export type ConnectionSegment = {
  from: { x: number; y: number }
  to: { x: number; y: number }
}

export function overlapArea(a: PopupRect, b: PopupRect) {
  return (
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  )
}

export function coveredConnectionLength(
  rect: PopupRect,
  segment: ConnectionSegment
) {
  const dx = segment.to.x - segment.from.x
  const dy = segment.to.y - segment.from.y
  let start = 0
  let end = 1
  // Clip the segment to the popup rectangle, not its axis-aligned bounding box.
  for (const [p, q] of [
    [-dx, segment.from.x - rect.left],
    [dx, rect.right - segment.from.x],
    [-dy, segment.from.y - rect.top],
    [dy, rect.bottom - segment.from.y],
  ]) {
    if (p === 0) {
      if (q < 0) return 0
      continue
    }
    const ratio = q / p
    if (p < 0) start = Math.max(start, ratio)
    else end = Math.min(end, ratio)
    if (start >= end) return 0
  }
  return Math.hypot(dx, dy) * (end - start)
}
