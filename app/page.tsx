import AddConnectionsDrawer from "@/components/add-connections-drawer"
import NystarNetworkMap from "@/components/nystar-network-map"
import ThemeToggleButton from "@/components/theme-toggle-button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { getNystarNetworkData } from "@/lib/nystar-locations"

export default async function Page() {
  const { locations, categories, regions } = await getNystarNetworkData()

  return (
    <SidebarProvider className="network-screen">
      <Sidebar collapsible="icon">
        <SidebarHeader className="flex-row items-start justify-between gap-2 px-4 pt-5 pb-3">
          <h1 className="network-sidebar__title group-data-[collapsible=icon]:hidden">
            The NYSTAR Innovation Network
          </h1>
          <SidebarTrigger
            className="ml-auto"
            title="Toggle sidebar"
          />
        </SidebarHeader>
        <SidebarContent className="px-4">
          <div className="group-data-[collapsible=icon]:hidden">
            <AddConnectionsDrawer categories={categories} regions={regions} />
          </div>
        </SidebarContent>
        <SidebarFooter className="items-end">
          <ThemeToggleButton />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="network-map-panel">
        <SidebarTrigger
          className="network-map-sidebar-trigger md:hidden"
          title="Toggle sidebar"
        />
        <NystarNetworkMap locations={locations} />
      </SidebarInset>
    </SidebarProvider>
  )
}
