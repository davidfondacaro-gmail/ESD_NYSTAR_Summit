export function nystarCoordinateOverride(row: {
  ID: string
  XLongitute?: string
  YLatitude?: string
}) {
  const longitudeText = row.XLongitute?.trim() ?? ""
  const latitudeText = row.YLatitude?.trim() ?? ""
  if (!longitudeText && !latitudeText) return null

  const longitude = Number(longitudeText)
  const latitude = Number(latitudeText)
  if (
    !longitudeText ||
    !latitudeText ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error(
      `${row.ID}: provide both XLongitute (-180 to 180) and YLatitude (-90 to 90), or leave both blank.`
    )
  }
  return { longitude, latitude }
}
