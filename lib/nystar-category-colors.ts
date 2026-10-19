export const CATEGORY_COLORS: Record<string, string> = {
  "Centers for Advanced Technology": "#72a7c0",
  "Centers for Advanced Technology--NO LONGER OPERATING": "#c7b85d",
  "Centers of Excellence": "#c58b32",
  "Innovation Hot Spot": "#4e927a",
  "New York Manufacturing Extension Partnership": "#4786a4",
  "New York State Accelerators and Competition": "#ba7050",
  "New York State Accelerators and Competitions": "#ad839a",
  "NY Fashion Innovation Center": "#a97fb2",
  "NY Global Entrepreneurs Program": "#4f9697",
  "NYS-Certified Business Incubator": "#a4934f",
}

export function categoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? "var(--network-customer-marker)"
}
