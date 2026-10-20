<script lang="ts">
  import { CircleLayer, GeoJSON, MapLibre, Popup, type Map as MapLibreMap } from "svelte-maplibre"
  import type { ConfigState, SelectedStation } from "$lib/state"
  import * as Card from "$lib/components/ui/card"
  import { Button } from "$lib/components/ui/button"
  import { Input } from "$lib/components/ui/input"
  import { Label } from "$lib/components/ui/label"
  import { mode as appearanceMode } from "mode-watcher"
  import type { FeatureCollection, Point } from "geojson"
  import * as turf from "@turf/turf"
  import { api, type StationListEntry } from "$lib/api"
  import { onMount } from "svelte"
  import { ArrowDown, ArrowUp, LoaderCircle, Search, Trash2 } from "@lucide/svelte"
  import StationPopup from "./StationPopup.svelte"
  import StationPreview from "./StationPreview.svelte"
  import { fly } from "svelte/transition"
  import { MAX_STATIONS, rowsOnDisplay } from "./limits"

  interface Props {
    config: ConfigState
    onsave?: (stations: SelectedStation[]) => void
  }

  let { config, onsave }: Props = $props()

  let selected: SelectedStation[] = $state(config.stations.map((s) => ({ ...s })))
  let allStations: StationListEntry[] = $state([])
  let loadState: "loading" | "loaded" | "error" = $state("loading")
  let loadError = $state("")
  let map: MapLibreMap | undefined = $state()
  let query = $state("")

  let mapStyle = $derived($appearanceMode === "dark" ? "dark-matter-gl" : "positron-gl")
  let rows = $derived(rowsOnDisplay(config.headerText))

  const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

  let searchResults = $derived(
    query.trim().length < 2
      ? []
      : allStations
          .filter((station) => normalize(station.name).includes(normalize(query.trim())))
          .slice(0, 8)
  )

  let stationFeatures: FeatureCollection<Point, { stationId: string; selected: boolean }> =
    $derived(
      turf.featureCollection(
        allStations.map((station) =>
          turf.point([station.lon, station.lat], {
            stationId: station.stationId,
            selected: selected.some((s) => s.stationId === station.stationId)
          })
        )
      )
    )

  async function loadStations() {
    loadState = "loading"
    try {
      allStations = await api.listStations()
      loadState = "loaded"

      // Center on the stations, ignoring the odd test station far away
      const serviceAreas = await api.getServiceAreas()
      const bbox =
        serviceAreas.features.length > 0 ? turf.bbox(serviceAreas) : turf.bbox(stationFeatures)
      map?.fitBounds(bbox as [number, number, number, number], {
        animate: false,
        padding: 20,
        maxZoom: 15
      })
    } catch (err: any) {
      loadError = err.message
      loadState = "error"
    }
  }

  function isSelected(stationId: string) {
    return selected.some((s) => s.stationId === stationId)
  }

  function addStation(station: StationListEntry) {
    if (isSelected(station.stationId) || selected.length >= MAX_STATIONS) return
    selected.push({ stationId: station.stationId, name: station.name, customName: "" })
  }

  function removeStation(stationId: string) {
    selected = selected.filter((s) => s.stationId !== stationId)
  }

  function moveStation(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= selected.length) return
    const [station] = selected.splice(index, 1)
    selected.splice(target, 0, station)
  }

  function pickSearchResult(station: StationListEntry) {
    query = ""
    addStation(station)
    map?.flyTo({ center: [station.lon, station.lat], zoom: 16, animate: false })
  }

  onMount(() => {
    loadStations()
  })
</script>

<div class="flex h-full w-full flex-col-reverse md:flex-row">
  <div class="flex w-full flex-col overflow-y-auto p-4 md:w-3/5">
    <div class="mb-4">
      <h2 class="mb-2 mt-0 scroll-m-20 text-3xl font-semibold tracking-tight">Selected Stations</h2>

      <p class="leading-6">
        Search for a station by name to add it to your Bike Tracker, or click a station on the map
        to see how many bikes it has right now.
      </p>
      <p class="mt-2 leading-6">
        Your display shows {rows}
        {rows === 1 ? "station" : "stations"} at a time. You can give each station a short name so it
        fits on the display, for example "Home" or "Work".
      </p>
    </div>

    <div class="relative mb-4">
      <Search class="absolute left-2 top-2.5 text-muted-foreground" size={16} />
      <Input
        class="pl-8"
        placeholder="Search stations, e.g. Part-Dieu"
        bind:value={query}
        disabled={loadState !== "loaded"}
      />
      {#if searchResults.length > 0}
        <div class="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-md">
          {#each searchResults as station (station.stationId)}
            <button
              class="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
              onclick={() => pickSearchResult(station)}
            >
              {station.name}
              {#if isSelected(station.stationId)}
                <span class="text-muted-foreground">(added)</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    {#if loadState === "error"}
      <div class="mb-4 text-sm text-red-500">
        Could not load stations from the API server: {loadError}. Check that the server is running
        and that its address is right in the Advanced tab.
      </div>
      <Button variant="secondary" size="sm" class="mb-4 self-start" onclick={loadStations}>
        Try again
      </Button>
    {/if}

    {#each selected as station, index (station.stationId)}
      <Card.Root class="mb-3 {index >= rows ? 'opacity-60' : ''}">
        <Card.Header class="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-3">
          <Card.Title class="text-lg">{station.name}</Card.Title>
          <div class="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Move up"
              disabled={index === 0}
              onclick={() => moveStation(index, -1)}><ArrowUp /></Button
            >
            <Button
              variant="ghost"
              size="icon"
              aria-label="Move down"
              disabled={index === selected.length - 1}
              onclick={() => moveStation(index, 1)}><ArrowDown /></Button
            >
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove"
              onclick={() => removeStation(station.stationId)}><Trash2 /></Button
            >
          </div>
        </Card.Header>
        <Card.Content class="flex flex-col gap-2 p-4 pt-0">
          <Label for="name-{station.stationId}">Name on the display (optional)</Label>
          <Input
            id="name-{station.stationId}"
            class="h-8 px-2 py-1"
            placeholder={station.name}
            maxlength={40}
            bind:value={station.customName}
          />
          {#if index >= rows}
            <div class="text-sm text-muted-foreground">
              Not shown: the display only has room for {rows}
              {rows === 1 ? "station" : "stations"}.
            </div>
          {/if}
        </Card.Content>
      </Card.Root>
    {/each}

    <div class="mt-4 flex flex-grow flex-col justify-end gap-3">
      {#if selected.length > 0}
        <div transition:fly={{ duration: 300, y: 10 }}>
          <h3 class="mb-2 scroll-m-20 text-2xl font-semibold tracking-tight">Preview</h3>
          <StationPreview stations={selected} />
        </div>
      {/if}

      <Button size="lg" onclick={() => onsave?.(selected)}>Save</Button>
    </div>
  </div>

  <MapLibre
    bind:map
    style={`https://basemaps.cartocdn.com/gl/${mapStyle}-style/style.json`}
    standardControls
    class="relative h-full w-full"
    bounds={[4.75, 45.67, 5.0, 45.91]}
  >
    <GeoJSON id="stations" data={stationFeatures}>
      <CircleLayer
        id="stations-circles"
        hoverCursor="pointer"
        paint={{
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 15, 8],
          "circle-color": ["case", ["get", "selected"], "#2ecc40", "#e2001a"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5
        }}
      >
        <!-- The popup must live inside the layer: svelte-maplibre only renders
             popup content for a clicked feature or a marker. -->
        <Popup openOn="click" popupClass="p-0">
          {#snippet children({ data })}
            {@const station = allStations.find((s) => s.stationId === data?.properties?.stationId)}
            {#if station}
              {#key station.stationId}
                <StationPopup
                  {station}
                  selected={isSelected(station.stationId)}
                  disabled={selected.length >= MAX_STATIONS}
                  onadd={addStation}
                  onremove={(station) => removeStation(station.stationId)}
                />
              {/key}
            {/if}
          {/snippet}
        </Popup>
      </CircleLayer>
    </GeoJSON>

    {#if loadState === "loading"}
      <div
        class="pointer-events-none absolute z-[999] flex h-full w-full items-center justify-center"
      >
        <p class="rounded-lg bg-black/60 p-4 text-4xl text-white">
          <LoaderCircle class="animate-spin" />
        </p>
      </div>
    {/if}
  </MapLibre>
</div>
