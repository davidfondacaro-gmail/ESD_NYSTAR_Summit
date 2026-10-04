import AddConnectionsDrawer from "@/components/add-connections-drawer"
import NystarNetworkMap from "@/components/nystar-network-map"
import { getNystarLocations } from "@/lib/nystar-locations"

export default async function Page() {
  const locations = await getNystarLocations()

  return (
    <main className="network-screen">
      <aside className="network-sidebar">
        <h1 className="network-sidebar__title">NYSTAR Network</h1>
        <AddConnectionsDrawer />
      </aside>
      <section className="network-map-panel" aria-label="NYSTAR locations map">
        <NystarNetworkMap locations={locations} />
      </section>
    </main>
  )
}
