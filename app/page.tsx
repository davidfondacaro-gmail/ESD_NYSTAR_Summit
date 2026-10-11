import NetworkExplorerPanel from "@/components/network-explorer-panel"
import { getNystarNetworkData } from "@/lib/nystar-locations"

export default async function Page() {
  const networkData = await getNystarNetworkData()

  return <NetworkExplorerPanel {...networkData} />
}
