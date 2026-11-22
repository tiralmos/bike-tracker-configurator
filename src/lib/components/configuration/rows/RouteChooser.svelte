<script lang="ts">
  import type { RouteAtStop } from "$lib/state"
  import Skeleton from "../../Skeleton.svelte"
  import { Button } from "$lib/components/ui/button"
  import { api, type Route, type Stop } from "$lib/api"

  interface Props {
    shown: boolean
    stop: Stop
    selected: RouteAtStop[]
    onRouteSelected: (route: RouteAtStop) => void
    onRouteDeselected: (route: RouteAtStop) => void
    disabled?: boolean
  }

  const {
    shown,
    stop,
    selected,
    onRouteSelected,
    onRouteDeselected,
    disabled = false
  }: Props = $props()

  let routes: Route[] = $state([])
  let loadState: "idle" | "loading" | "loaded" | "error" = $state("idle")
  let loadError: string | null = $state(null)

  async function loadRoutes() {
    loadState = "loading"
    loadError = null

    try {
      routes = await api.getRoutesForStop(stop.stopId)
      loadState = "loaded"
    } catch (err: any) {
      loadError = `Failed to load routes: ${err.message}`
      loadState = "error"
      console.error("Error loading routes for stop:", err)
    }
  }

  function isSelected(routeId: string) {
    return selected.some((sr) => sr.routeId === routeId && sr.stopId === stop.stopId)
  }

  function onRouteCheckboxChange(event: Event, route: Route) {
    const target = event.target as HTMLInputElement

    const routeAtStop: RouteAtStop = {
      stopId: stop.stopId,
      stopCode: stop.stopCode,
      stopName: stop.name,
      routeId: route.routeId,
      routeName: route.name,
      headsigns: route.headsigns,
      color: route.color
    }

    if (target.checked) {
      onRouteSelected(routeAtStop)
    } else {
      onRouteDeselected(routeAtStop)
    }
  }

  $effect(() => {
    if (shown && loadState === "idle") {
      loadRoutes()
    }
  })
</script>

<div class="bg-background px-4 py-2 text-foreground">
  <h4 class="mb-2 scroll-m-20 text-lg font-semibold tracking-tight">
    {stop.name}
    {#if stop.stopCode !== null}
      ({stop.stopCode})
    {/if}
  </h4>
  {#if loadState === "error"}
    <div class="text-sm text-red-500">{loadError}</div>
    <Button variant="secondary" size="xs" class="mt-2" onclick={loadRoutes}>Try again</Button>
  {:else if loadState === "loaded" && routes.length === 0}
    <div class="text-center text-sm italic text-muted-foreground">No lines serve this stop.</div>
  {:else if routes.length === 0}
    <Skeleton />
  {/if}
  {#each routes as route, index}
    {@const routeSelected = isSelected(route.routeId)}
    <div class="route">
      <label>
        <input
          type="checkbox"
          checked={routeSelected}
          value={index}
          onchange={(e) => onRouteCheckboxChange(e, route)}
          disabled={!routeSelected && disabled}
        />
        <div class="-mt-[3px]">
          <strong>Line {route.name}</strong>
          {#each route.headsigns as headsign}
            <div class="headsign"><strong>→</strong> {headsign}</div>
          {/each}
        </div>
      </label>
    </div>
  {/each}
</div>

<style>
  .route {
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      Oxygen,
      Ubuntu,
      Cantarell,
      "Open Sans",
      "Helvetica Neue",
      sans-serif;
  }

  .route:not(:last-child) {
    margin-bottom: 0.5em;
  }

  .route label {
    display: flex;
    align-items: flex-start;
    gap: 2px;
  }
</style>
