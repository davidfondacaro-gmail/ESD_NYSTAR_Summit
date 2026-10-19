import { connection } from "next/server"

import NetworkExplorerPanel from "@/components/network-explorer-panel"
import { getNystarNetworkData } from "@/lib/nystar-locations"

export default async function Page() {
  await connection()
  const networkData = await getNystarNetworkData()

  return <NetworkExplorerPanel {...networkData} />
}
