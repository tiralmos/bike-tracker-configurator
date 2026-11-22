<script lang="ts">
  import { Control, DefaultMarker, FillLayer, GeoJSON, LineLayer } from "svelte-maplibre"
  import { MapLibre, type Map as MapLibreMap } from "svelte-maplibre"
  import RowPreview from "./RowPreview.svelte"
  import type { ConfigState, RouteAtStop, TransitRow } from "$lib/state"
  import debounce from "p-debounce"
  import * as Card from "$lib/components/ui/card"
  import { Button } from "$lib/components/ui/button"
  import { Checkbox } from "$lib/components/ui/checkbox"
  import { Separator } from "../../ui/separator"
  import { Label } from "$lib/components/ui/label"
  import { Input } from "../../ui/input"
  import { mode as appearanceMode } from "mode-watcher"
  import type { BBox, FeatureCollection } from "geojson"
  import * as turf from "@turf/turf"
  import { api, type Stop } from "$lib/api"
  import { onMount } from "svelte"
  import { LoaderCircle, TriangleAlert } from "@lucide/svelte"
  import * as Tooltip from "$lib/components/ui/tooltip"
  import RouteChooserPopup from "./RouteChooserPopup.svelte"
  import AddressSearch from "./AddressSearch.svelte"
  import { fly, slide } from "svelte/transition"

  interface Props {
    config: ConfigState
    /** The lines already on the display */
    initial: RouteAtStop[]
    /** How many lines can be selected in total */
    maxSelected: number
    onsave?: (routes: RouteAtStop[], timeOffsets: Record<string, number>) => void
    oncancel?: () => void
  }

  let { config, initial, maxSelected, onsave, oncancel }: Props = $props()

  let serviceAreas: FeatureCollection = $state({
    type: "FeatureCollection",
    features: []
  })

  let selected: RouteAtStop[] = $state(initial.map((r) => ({ ...r })))
  let timeOffsets = $state({ ...config.stopTimeOffsets })
  let disabled = $derived(selected.length >= maxSelected)
  // Bike-share stations are stops too in the API; they are picked in the
  // Vélo'v station chooser, so hide them here.
  let bikeStationIds = new Set<string>()

  let previewRows: TransitRow[] = $derived(
    selected.map((route) => ({ kind: "transit", ...route, customName: "" }))
  )
  let stopGroups: Stop[][] = $state([])
  let abortController: AbortController | null = $state(null)
  let lastBbox: BBox | null = $state(null)
  let map: MapLibreMap | undefined = $state()

  let mapStyle = $derived($appearanceMode === "dark" ? "dark-matter-gl" : "positron-gl")

  let needsZoomIn = $state(true)

  const selectionGroupedByStop = $derived(Map.groupBy(selected, (r) => r.stopId).values())

  async function loadBikeStationIds() {
    try {
      const stations = await api.listStations()
      bikeStationIds = new Set(stations.map((station) => station.stationId))
    } catch {
      // No bike-share feed; nothing to hide
    }
  }

  async function getServiceAreas() {
    serviceAreas = await api.getServiceAreas()

    const bbox = turf.bbox(serviceAreas)
    map?.fitBounds(bbox as [number, number, number, number], {
      animate: false,
      padding: 20,
      maxZoom: 15
    })
  }

  function groupVeryCloseStops(stops: Stop[]) {
    const grouped: Stop[][] = []

    for (const stop of stops) {
      const existingGroup = grouped.find((group) => {
        const dist = turf.distance(
          turf.point([stop.lon, stop.lat]),
          turf.point([group[0].lon, group[0].lat]),
          { units: "meters" }
        )
        return dist < 15
      })

      if (existingGroup) {
        existingGroup.push(stop)
      } else {
        grouped.push([stop])
      }
    }

    return grouped
  }

  async function getStops(bounds: number[][]) {
    abortController?.abort()

    const controller = new AbortController()
    abortController = controller

    try {
      const response = await api.getStopsWithin(bounds, controller.signal)
      return groupVeryCloseStops(response.filter((stop) => !bikeStationIds.has(stop.stopId)))
    } finally {
      if (abortController === controller) {
        abortController = null
      }
    }
  }

  function isAbortError(error: any) {
    return error instanceof Error && error.name === "AbortError"
  }

  async function _onMapMoved({ target }: { target: MapLibreMap }) {
    if (target.getZoom() < 15) {
      abortController?.abort()
      needsZoomIn = true
      stopGroups = []
      return
    }

    if (
      lastBbox &&
      turf.booleanContains(
        turf.bboxPolygon(lastBbox),
        turf.bboxPolygon(boundsToBbox(target.getBounds()))
      )
    ) {
      return
    }

    needsZoomIn = false

    const bounds = target.getBounds()

    try {
      stopGroups = await getStops(bounds.toArray())
      lastBbox = boundsToBbox(bounds)
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error loading stops:", error)
      }
    }
  }

  function boundsToBbox(bounds: maplibregl.LngLatBounds): [number, number, number, number] {
    return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
  }

  function colorIsDark(color: string) {
    const r = parseInt(color.slice(0, 2), 16)
    const g = parseInt(color.slice(2, 4), 16)
    const b = parseInt(color.slice(4, 6), 16)
    return Math.max(r, g, b) < 80
  }

  function isErrorWebGlRelated(error: any) {
    return (
      error instanceof Error && (error.message.includes("WebGL") || error.message.includes("webgl"))
    )
  }

  function formatErrorWithStack(error: any) {
    if (error instanceof Error) {
      return ["```", `${error.name}: ${error.message}\n`, error.stack ?? "", "```"].join("\n")
    }

    return ["```", String(error), "```"].join("\n")
  }

  async function copyErrorDetails(error: any) {
    await navigator.clipboard.writeText(formatErrorWithStack(error))
  }

  const onMapMoved = debounce(_onMapMoved, 1000)

  onMount(() => {
    loadBikeStationIds()
    getServiceAreas()
  })
</script>

<div class="flex h-full w-full flex-col-reverse md:flex-row">
  <div class="flex w-full flex-col overflow-y-auto p-4 md:w-3/5">
    <div class="mb-4">
      <h2
        class="mb-2 mt-0 scroll-m-20 text-3xl font-semibold tracking-tight transition-colors first:mt-0"
      >
        Transit lines
      </h2>

      <p class="leading-6 [&:not(:first-child)]:mt-2">
        Find your stop on the map (zoom in, or search an address), click it, then tick the lines you
        want on your display. Each line becomes one row; you can reorder the rows and give them a
        short name after saving.
      </p>

      <p class="leading-6 [&:not(:first-child)]:mt-2">
        You can also optionally set a travel time for each stop; this will adjust the countdown time
        to account for the time it takes for you to get to the stop. For example, if it takes you 5
        minutes to walk to a stop, set the travel time to 5 minutes.
      </p>
    </div>

    {#each selectionGroupedByStop as routes}
      <Card.Root class="mb-3">
        <Card.Header class="px-4 pb-2 pt-3">
          <Card.Title class="text-lg">
            {routes[0].stopName}
            {#if routes[0].stopCode}
              ({routes[0].stopCode})
            {/if}
          </Card.Title>
        </Card.Header>
        <Card.Content class="p-4 pt-0">
          <div class="flex flex-col gap-2">
            {#if timeOffsets[routes[0].stopId]}
              <Label>Travel time in minutes</Label>
              <Input
                type="number"
                value={timeOffsets[routes[0].stopId]}
                class="h-8 px-2 py-1"
                oninput={(e) => (timeOffsets[routes[0].stopId] = parseInt(e.currentTarget.value))}
              />
            {:else}
              <Button
                variant="secondary"
                size="xs"
                onclick={() => (timeOffsets[routes[0].stopId] = 1)}>Set travel time</Button
              >
            {/if}
          </div>

          <Separator class="my-4" />

          {#each routes as route (route.routeId + route.stopId)}
            {@const hasDarkColor = route.color ? colorIsDark(route.color) : false}
            <div class="selected-route [&:not(:last-child)]:mb-2">
              <label class="flex cursor-pointer items-start gap-2">
                <Checkbox
                  checked
                  onCheckedChange={() =>
                    selected.splice(
                      selected.findIndex(
                        (r) => r.routeId === route.routeId && r.stopId === route.stopId
                      ),
                      1
                    )}
                />
                <div class="-mt-[3px]">
                  {#if hasDarkColor}
                    <Tooltip.Provider>
                      <Tooltip.Root delayDuration={0}>
                        <Tooltip.Trigger>
                          <TriangleAlert
                            class="relative bottom-[2px] inline text-orange-500 dark:text-yellow-500"
                            size={18}
                          />
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                          <p class="max-w-64">
                            This route uses a color that might not show up very well on your Transit
                            Tracker. You can change the color of this route in the <strong
                              >Customize</strong
                            > tab after saving.
                          </p>
                        </Tooltip.Content>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  {/if}
                  <strong>
                    Line {route.routeName}
                  </strong>
                  {#each route.headsigns as headsign}
                    <div class="headsign"><strong>→</strong> {headsign}</div>
                  {/each}
                </div>
              </label>
            </div>
          {/each}
        </Card.Content>
      </Card.Root>
    {/each}

    <div class="mt-4 flex flex-grow flex-col justify-end gap-3">
      {#if selected.length > 0}
        <div transition:fly={{ duration: 300, y: 10 }}>
          <h3 class="mb-2 scroll-m-20 text-2xl font-semibold tracking-tight">Preview</h3>
          <RowPreview rows={previewRows} {timeOffsets} />
        </div>
      {/if}

      {#if disabled}
        <div class="text-sm text-muted-foreground">
          You've reached the maximum of {maxSelected} rows that fit in the display's settings.
        </div>
      {/if}

      <div class="flex gap-2">
        <Button size="lg" variant="secondary" class="flex-grow" onclick={() => oncancel?.()}
          >Cancel</Button
        >
        <Button size="lg" class="flex-grow" onclick={() => onsave?.(selected, timeOffsets)}
          >Save</Button
        >
      </div>
    </div>
  </div>

  <svelte:boundary>
    {#snippet failed(error: any)}
      <div class="flex h-full w-full flex-col items-center justify-center gap-4 p-8 sm:p-12">
        <div class="w-full max-w-2xl rounded-lg border bg-background/95 p-6 shadow-sm">
          <p class="text-center text-xl font-semibold tracking-tight">Failed to load route map</p>

          {#if isErrorWebGlRelated(error)}
            <div
              class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <p>
                It looks like your browser either doesn't support WebGL or has it disabled. Please
                try:
              </p>
              <ul class="mt-2 list-inside list-disc">
                <li>Updating your browser and GPU drivers to the latest version</li>
                <li>Enabling WebGL and hardware acceleration in your browser settings</li>
              </ul>
            </div>
          {/if}

          <div class="mt-4 rounded-md border bg-muted/40 p-3 text-left">
            <p class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
              Error details
            </p>
            <p
              class="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-background/70 p-2 font-mono text-xs sm:text-sm"
            >
              {error}
            </p>
            <div class="mt-2 flex justify-start">
              <Button size="sm" variant="outline" onclick={() => copyErrorDetails(error)}>
                Copy error
              </Button>
            </div>
          </div>
        </div>
      </div>
    {/snippet}

    <MapLibre
      bind:map
      style={`https://basemaps.cartocdn.com/gl/${mapStyle}-style/style.json`}
      standardControls
      class="h-full w-full"
      onmoveend={onMapMoved}
      bounds={[4.75, 45.67, 5.0, 45.91]}
    >
      <Control position="top-right">
        <AddressSearch
          onPlaceSelected={(location) => {
            map?.flyTo({ center: [location.lng, location.lat], zoom: 16, animate: false })
          }}
        />
      </Control>

      <GeoJSON id="service-areas" data={serviceAreas} maxzoom={15}>
        <FillLayer
          id="service-areas-fill"
          paint={{
            "fill-color": "#51c551",
            "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 10, 0.5, 13, 0]
          }}
        />

        <LineLayer
          id="service-areas-line"
          paint={{
            "line-color": "#51c551",
            "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 1, 10, 0.8, 13, 0],
            "line-width": 2
          }}
        />
      </GeoJSON>

      {#each stopGroups as stops (stops[0].stopId)}
        <DefaultMarker lngLat={[stops[0].lon, stops[0].lat]} class="cursor-pointer">
          <RouteChooserPopup
            {stops}
            {selected}
            {disabled}
            onRouteSelected={(route: RouteAtStop) => selected.push(route)}
            onRouteDeselected={(route: RouteAtStop) =>
              selected.splice(
                selected.findIndex((r) => r.routeId === route.routeId && r.stopId === route.stopId),
                1
              )}
          />
        </DefaultMarker>
      {/each}

      {#if needsZoomIn}
        <div
          class="pointer-events-none absolute z-[999] flex h-full w-full items-center justify-center text-center"
        >
          <p class="rounded-lg bg-black/60 p-4 text-4xl text-white">Zoom in to see stops</p>
        </div>
      {/if}

      {#if !needsZoomIn && abortController}
        <div
          class="pointer-events-none absolute z-[999] flex h-full w-full items-center justify-center text-center"
        >
          <p class="rounded-lg bg-black/60 p-4 text-4xl text-white">
            <LoaderCircle class="animate-spin" />
          </p>
        </div>
      {/if}

      {#if !needsZoomIn && !abortController && stopGroups.length === 0}
        <div
          class="pointer-events-none absolute z-[999] flex h-full w-full items-center justify-center text-center"
        >
          <p class="flex flex-col rounded-lg bg-black/60 p-3 text-2xl text-white">
            No stops found
            <span class="mt-1 text-sm">
              If you expected stops here, check that the TCL timetables have finished importing.
            </span>
          </p>
        </div>
      {/if}
    </MapLibre>
  </svelte:boundary>
</div>
