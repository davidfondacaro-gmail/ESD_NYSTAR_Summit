import AddConnectionsDrawer from "@/components/add-connections-drawer"
import NystarNetworkMap from "@/components/nystar-network-map"
import { getNystarNetworkData } from "@/lib/nystar-locations"

export default async function Page() {
  const { locations, categories, regions } = await getNystarNetworkData()

  return (
    <main className="network-screen">
      <aside className="network-sidebar">
        <h1 className="network-sidebar__title">NYSTAR Network</h1>
        <AddConnectionsDrawer categories={categories} regions={regions} />
      </aside>
      <section className="network-map-panel" aria-label="NYSTAR locations map">
        <NystarNetworkMap locations={locations} />
      </section>
    </main>
  )
}
