<script lang="ts">
  import {
    ArrowDown,
    ArrowUp,
    Bike,
    CopyPlus,
    Plus,
    TrainFront,
    Trash2,
    TriangleAlert
  } from "@lucide/svelte"
  import { Button } from "../../ui/button"
  import { Input } from "../../ui/input"
  import { Label } from "../../ui/label"
  import * as RadioGroup from "../../ui/radio-group"
  import * as Card from "../../ui/card"
  import RouteStopChooser from "./RouteStopChooser.svelte"
  import StationChooser from "../stations/StationChooser.svelte"
  import RowPreview from "./RowPreview.svelte"
  import {
    config,
    isLoopbackUrl,
    isSameRouteAtStop,
    rowKey,
    type BikeRow,
    type DisplayRow,
    type RouteAtStop,
    type TransitRow
  } from "$lib/state"
  import { scale } from "svelte/transition"
  import { goto } from "$app/navigation"
  import { MAX_ROWS, rowsOnDisplay } from "./limits"

  let editor: "none" | "transit" | "bike" = $state("none")

  let rows = $derived($config.rows)
  let visibleRows = $derived(rowsOnDisplay($config.headerText))

  let transitRows = $derived(rows.filter((row): row is TransitRow => row.kind === "transit"))
  let bikeRows = $derived(rows.filter((row): row is BikeRow => row.kind === "bike"))

  /** Each line at a stop once, for the transit chooser */
  let uniqueRoutes: RouteAtStop[] = $derived(
    transitRows
      .filter(
        (row, index) => transitRows.findIndex((other) => isSameRouteAtStop(other, row)) === index
      )
      .map(({ kind, customName, ...route }) => route)
  )

  let transitMax = $derived(MAX_ROWS - bikeRows.length - (transitRows.length - uniqueRoutes.length))
  let bikeMax = $derived(MAX_ROWS - transitRows.length)

  function saveTransit(routes: RouteAtStop[], timeOffsets: Record<string, number>) {
    const kept = $config.rows.flatMap((row): DisplayRow[] => {
      if (row.kind !== "transit") return [row]
      const route = routes.find((r) => isSameRouteAtStop(r, row))
      return route ? [{ ...row, ...route }] : []
    })
    const added = routes
      .filter(
        (route) => !kept.some((row) => row.kind === "transit" && isSameRouteAtStop(row, route))
      )
      .map((route): TransitRow => ({ kind: "transit", ...route, customName: "" }))

    $config.rows = [...kept, ...added]
    $config.stopTimeOffsets = timeOffsets
    $config.routeStyles = $config.routeStyles.filter((style) =>
      $config.rows.some((row) => row.kind === "transit" && row.routeId === style.routeId)
    )
    editor = "none"
  }

  function saveStations(stations: BikeRow[]) {
    const kept = $config.rows.flatMap((row): DisplayRow[] => {
      if (row.kind !== "bike") return [row]
      const station = stations.find((s) => s.stationId === row.stationId)
      return station ? [{ ...row, name: station.name }] : []
    })
    const added = stations.filter(
      (station) => !kept.some((row) => row.kind === "bike" && row.stationId === station.stationId)
    )

    $config.rows = [...kept, ...added]
    editor = "none"
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= $config.rows.length) return
    const next = [...$config.rows]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    $config.rows = next
  }

  function removeRow(index: number) {
    $config.rows = $config.rows.filter((_, i) => i !== index)
  }

  /** Adds the same line below, which then shows the departure after. */
  function addFollowingDeparture(index: number) {
    const next = [...$config.rows]
    next.splice(index + 1, 0, { ...next[index], customName: "" })
    $config.rows = next
  }

  function badgeStyle(row: TransitRow) {
    const style = $config.routeStyles.find((s) => s.routeId === row.routeId)
    const color = style?.color ?? (row.color ? `#${row.color}` : "#028e51")
    return `background-color: ${color}`
  }

  /** Repeated lines show the following departures */
  function departureLabel(index: number) {
    const row = rows[index]
    if (row.kind !== "transit") return ""
    const occurrence = rows
      .slice(0, index)
      .filter((other) => other.kind === "transit" && isSameRouteAtStop(other, row)).length
    return occurrence === 0 ? "Next departure" : `Departure after next (+${occurrence})`
  }
</script>

{#if editor === "transit"}
  <div
    class="fixed left-0 top-0 z-50 h-full w-full bg-background"
    transition:scale={{ duration: 300, start: 0.9 }}
  >
    <RouteStopChooser
      config={$config}
      initial={uniqueRoutes}
      maxSelected={transitMax}
      onsave={saveTransit}
      oncancel={() => (editor = "none")}
    />
  </div>
{:else if editor === "bike"}
  <div
    class="fixed left-0 top-0 z-50 h-full w-full bg-background"
    transition:scale={{ duration: 300, start: 0.9 }}
  >
    <StationChooser
      initial={bikeRows}
      maxSelected={bikeMax}
      onsave={saveStations}
      oncancel={() => (editor = "none")}
    />
  </div>
{/if}

{#if isLoopbackUrl($config.apiBaseUrl)}
  <div
    class="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
  >
    <TriangleAlert class="mb-1 inline" size={16} />
    The API server is set to <code>{$config.apiBaseUrl}</code>, which your display cannot reach. Set
    it to your computer's address on your network (for example
    <code>http://192.168.1.10:3001</code>) in the
    <Button variant="link" size="small" onclick={() => goto("./advanced")}>Advanced</Button> tab.
  </div>
{/if}

<div class="mb-5">
  <h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Rows</h4>
  <div class="mb-3 text-sm text-muted-foreground">
    Each row shows either a TCL line at a stop, with its next departure, or a Vélo'v station, with
    its free docks and bikes. The display shows the first {visibleRows} rows.
  </div>

  {#each rows as row, index (rowKey(row) + ":" + index)}
    <Card.Root class="mb-2 {index >= visibleRows ? 'opacity-60' : ''}">
      <Card.Header class="flex flex-row items-start justify-between gap-2 space-y-0 px-3 pb-2 pt-2">
        <div class="flex min-w-0 items-start gap-2">
          {#if row.kind === "transit"}
            <TrainFront size={18} class="mt-1 shrink-0 text-muted-foreground" />
            <div class="min-w-0">
              <div class="font-semibold">
                <span class="rounded px-1.5 py-0.5 text-sm text-white" style={badgeStyle(row)}
                  >{row.routeName}</span
                >
                {row.stopName}
              </div>
              <div class="truncate text-xs text-muted-foreground">
                {departureLabel(index)}{#if row.headsigns.length > 0}
                  &nbsp;&middot; to {row.headsigns.join(" / ")}{/if}
              </div>
            </div>
          {:else}
            <Bike size={18} class="mt-1 shrink-0 text-muted-foreground" />
            <div class="min-w-0">
              <div class="font-semibold">{row.name}</div>
              <div class="text-xs text-muted-foreground">Vélo'v station</div>
            </div>
          {/if}
        </div>
        <div class="flex shrink-0">
          {#if row.kind === "transit"}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Also show the following departure"
              title="Also show the following departure"
              disabled={rows.length >= MAX_ROWS}
              onclick={() => addFollowingDeparture(index)}><CopyPlus /></Button
            >
          {/if}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Move up"
            disabled={index === 0}
            onclick={() => moveRow(index, -1)}><ArrowUp /></Button
          >
          <Button
            variant="ghost"
            size="icon"
            aria-label="Move down"
            disabled={index === rows.length - 1}
            onclick={() => moveRow(index, 1)}><ArrowDown /></Button
          >
          <Button variant="ghost" size="icon" aria-label="Remove" onclick={() => removeRow(index)}
            ><Trash2 /></Button
          >
        </div>
      </Card.Header>
      <Card.Content class="flex flex-col gap-1 px-3 pb-3 pt-0">
        <Label for="row-name-{index}" class="text-xs">Name on the display (optional)</Label>
        <Input
          id="row-name-{index}"
          class="h-8 px-2 py-1"
          placeholder={row.kind === "transit" ? "Destination of each trip" : row.name}
          maxlength={30}
          bind:value={$config.rows[index].customName}
        />
        {#if index >= visibleRows}
          <div class="text-xs text-muted-foreground">
            Not shown: the display only has room for {visibleRows} rows.
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  {/each}

  {#if rows.length === 0}
    <div class="mb-3 rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
      No rows yet. Add a transit line or a Vélo'v station to get started.
    </div>
  {/if}

  <div class="mt-3 flex flex-wrap gap-2">
    <Button
      size="sm"
      variant="secondary"
      disabled={transitMax <= 0 && uniqueRoutes.length === 0}
      onclick={() => (editor = "transit")}
    >
      <Plus />
      <TrainFront />
      {transitRows.length > 0 ? "Add or remove transit lines" : "Add a transit line"}
    </Button>
    <Button
      size="sm"
      variant="secondary"
      disabled={bikeMax <= 0 && bikeRows.length === 0}
      onclick={() => (editor = "bike")}
    >
      <Plus />
      <Bike />
      {bikeRows.length > 0 ? "Add or remove Vélo'v stations" : "Add a Vélo'v station"}
    </Button>
  </div>
</div>

{#if rows.length > 0}
  <div class="mb-5">
    <h4 class="mb-2 scroll-m-20 text-xl font-semibold tracking-tight">Preview</h4>
    <RowPreview rows={rows.slice(0, visibleRows)} />
  </div>
{/if}

<div class="mb-5">
  <h4 class="mb-2 scroll-m-20 text-xl font-semibold tracking-tight">Time Display</h4>

  <RadioGroup.Root bind:value={$config.timeDisplay}>
    <div class="flex items-center space-x-2">
      <RadioGroup.Item value="departure" id="departure" />
      <Label for="departure">Departure time</Label>
    </div>
    <div class="flex items-center space-x-2">
      <RadioGroup.Item value="arrival" id="arrival" />
      <Label for="arrival">Arrival time</Label>
    </div>
  </RadioGroup.Root>
</div>

<div class="mb-5">
  <h4 class="mb-2 scroll-m-20 text-xl font-semibold tracking-tight">Time Units</h4>

  <RadioGroup.Root bind:value={$config.timeUnits}>
    <div class="flex items-center space-x-2">
      <RadioGroup.Item value="long" id="long" />
      <Label for="long">Long (e.g., "5min" / "1h15m")</Label>
    </div>
    <div class="flex items-center space-x-2">
      <RadioGroup.Item value="short" id="short" />
      <Label for="short">Short (e.g., "5m" / "1h15m")</Label>
    </div>
    <div class="flex items-center space-x-2">
      <RadioGroup.Item value="none" id="none" />
      <Label for="none">None (e.g., "5" / "1:15")</Label>
    </div>
  </RadioGroup.Root>
</div>

<div class="mb-5">
  <h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Long Names</h4>
  <div class="mb-2 text-sm text-muted-foreground">
    Change how destinations and station names are displayed when they don't fit.
  </div>

  <RadioGroup.Root bind:value={$config.nameOverflow}>
    <div class="flex items-center space-x-2">
      <RadioGroup.Item value="hidden" id="hidden" />
      <Label for="hidden">Hidden &mdash; excess text will be cut off</Label>
    </div>
    <div class="flex items-center space-x-2">
      <RadioGroup.Item value="scroll" id="scroll" />
      <Label for="scroll">Scroll &mdash; names will scroll back and forth to reveal all text</Label>
    </div>
  </RadioGroup.Root>
</div>
