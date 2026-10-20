export type RecentConnection = {
  fromAssetId: string
  to: { kind: "asset" | "partner"; id: string }
  connectionType: "Existing" | "Desired"
  animateFromTarget?: boolean
}
