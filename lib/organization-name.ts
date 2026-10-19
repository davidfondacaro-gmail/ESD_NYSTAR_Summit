export function normalizeOrganizationName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
}
