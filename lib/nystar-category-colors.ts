// Colorblind-safe palette (Okabe-Ito based), one distinct hue per category.
export const CATEGORY_COLORS: Record<string, string> = {
  "Centers for Advanced Technology": "#0072b2",
  "Centers of Excellence": "#e69f00",
  "Innovation Hot Spot": "#009e73",
  "New York Manufacturing Extension Partnership": "#cc79a7",
  "New York State Accelerators and Competitions": "#d55e00",
  "NY Fashion Innovation Center": "#7b4fb8",
  "NY Global Entrepreneurs Program": "#56b4e9",
  "NYS Certified Business Incubator": "#8b5a2b",
}

export function categoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? "var(--network-customer-marker)"
}
