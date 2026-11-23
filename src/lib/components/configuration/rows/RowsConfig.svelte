<script lang="ts">
  import {
    ArrowDown,
    ArrowUp,
    Bike,
    Clock,
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
    activeSlotAt,
    allRows,
    config,
    isLoopbackUrl,
    isSameRouteAtStop,
    rowId,
    rowKey,
    slotLabel,
    slotProblem,
    type BikeRow,
    type DisplayRow,
    type RouteAtStop,
    type TransitRow
  } from "$lib/state"
  import { rowsStorageUsed } from "$lib/device"
  import { scale } from "svelte/transition"
  import { onDestroy } from "svelte"
  import { goto } from "$app/navigation"
  import { MAX_ROWS, rowsOnDisplay } from "./limits"

  let editor: "none" | "transit" | "bike" = $state("none")

  /** "default", or the ID of the time slot being edited */
  let selectedSlotId = $state("default")
  let selectedSlot = $derived($config.timeSlots.find((slot) => slot.id === selectedSlotId) ?? null)

  $effect(() => {
    if (selectedSlotId !== "default" && !selectedSlot) selectedSlotId = "default"
  })

  /** The rows of the default set or of the selected time slot */
  let rows = $derived(selectedSlot ? selectedSlot.rows : $config.rows)

  function setRows(next: DisplayRow[]) {
    if (selectedSlot) {
      const id = selectedSlot.id
      $config.timeSlots = $config.timeSlots.map((slot) =>
        slot.id === id ? { ...slot, rows: next } : slot
      )
    } else {
      $config.rows = next
    }
  }

  let storageUsed = $derived(rowsStorageUsed($config))

  let now = $state(new Date())
  const clock = setInterval(() => (now = new Date()), 30_000)
  onDestroy(() => clearInterval(clock))
  let activeSlot = $derived(activeSlotAt($config.timeSlots, now.getHours() * 60 + now.getMinutes()))

  /** A new slot starts where the last one ends */
  function addTimeSlot() {
    const last = $config.timeSlots.at(-1)
    const start = last?.end ?? "07:00"
    const [hours, minutes] = start.split(":").map(Number)
    const end = `${String((hours + 2) % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
    const slot = { id: crypto.randomUUID(), start, end, rows: [] }
    $config.timeSlots = [...$config.timeSlots, slot]
    selectedSlotId = slot.id
  }

  function updateSlotTime(field: "start" | "end", value: string) {
    if (!selectedSlot) return
    const id = selectedSlot.id
    $config.timeSlots = $config.timeSlots.map((slot) =>
      slot.id === id ? { ...slot, [field]: value } : slot
    )
  }

  function removeTimeSlot() {
    if (!selectedSlot) return
    const id = selectedSlot.id
    $config.timeSlots = $config.timeSlots.filter((slot) => slot.id !== id)
    selectedSlotId = "default"
  }

  /** A name belongs to a line at a stop or a station, in every slot */
  function setCustomName(row: DisplayRow, name: string) {
    const id = rowId(row)
    const rename = (list: DisplayRow[]) =>
      list.map((other) =>
        other.kind === row.kind && rowId(other) === id ? { ...other, customName: name } : other
      )
    $config.rows = rename($config.rows)
    $config.timeSlots = $config.timeSlots.map((slot) => ({ ...slot, rows: rename(slot.rows) }))
  }
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
    const kept = rows.flatMap((row): DisplayRow[] => {
      if (row.kind !== "transit") return [row]
      const route = routes.find((r) => isSameRouteAtStop(r, row))
      return route ? [{ ...row, ...route }] : []
    })
    const added = routes
      .filter(
        (route) => !kept.some((row) => row.kind === "transit" && isSameRouteAtStop(row, route))
      )
      .map((route): TransitRow => ({ kind: "transit", ...route, customName: "" }))

    setRows([...kept, ...added])
    $config.stopTimeOffsets = timeOffsets
    $config.routeStyles = $config.routeStyles.filter((style) =>
      allRows($config).some((row) => row.kind === "transit" && row.routeId === style.routeId)
    )
    editor = "none"
  }

  function saveStations(stations: BikeRow[]) {
    const kept = rows.flatMap((row): DisplayRow[] => {
      if (row.kind !== "bike") return [row]
      const station = stations.find((s) => s.stationId === row.stationId)
      return station ? [{ ...row, name: station.name }] : []
    })
    const added = stations.filter(
      (station) => !kept.some((row) => row.kind === "bike" && row.stationId === station.stationId)
    )

    setRows([...kept, ...added])
    editor = "none"
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    setRows(next)
  }

  function removeRow(index: number) {
    setRows(rows.filter((_, i) => i !== index))
  }

  /** Adds the same line below, which then shows the departure after. */
  function addFollowingDeparture(index: number) {
    const next = [...rows]
    next.splice(index + 1, 0, { ...next[index] })
    setRows(next)
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
  <h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Time slots</h4>
  <div class="mb-3 text-sm text-muted-foreground">
    Show other rows at some times of the day, for example your tram in the morning and your Vélo'v
    station in the evening. Outside every time slot, the display shows the default rows, or stays
    dark if there are none.
  </div>

  <div class="flex flex-wrap gap-2" role="tablist" aria-label="Rows to edit">
    <Button
      size="sm"
      role="tab"
      aria-selected={selectedSlotId === "default"}
      variant={selectedSlotId === "default" ? "default" : "outline"}
      onclick={() => (selectedSlotId = "default")}
    >
      Default rows
      {#if !activeSlot}<span class="ml-1 text-xs opacity-70">· now</span>{/if}
    </Button>
    {#each $config.timeSlots as slot (slot.id)}
      {@const problem = slotProblem(slot, $config.timeSlots)}
      <Button
        size="sm"
        role="tab"
        aria-selected={selectedSlotId === slot.id}
        variant={selectedSlotId === slot.id ? "default" : "outline"}
        class={problem ? "border-destructive text-destructive" : ""}
        onclick={() => (selectedSlotId = slot.id)}
      >
        {#if problem}<TriangleAlert />{:else}<Clock />{/if}
        {slotLabel(slot)}
        {#if activeSlot?.id === slot.id}<span class="ml-1 text-xs opacity-70">· now</span>{/if}
      </Button>
    {/each}
    <Button size="sm" variant="secondary" onclick={addTimeSlot}><Plus /> Add a time slot</Button>
  </div>

  {#if selectedSlot}
    {@const problem = slotProblem(selectedSlot, $config.timeSlots)}
    <div class="mt-3 flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1">
        <Label for="slot-start" class="text-xs">From</Label>
        <Input
          id="slot-start"
          type="time"
          class="h-8 w-32 px-2 py-1"
          value={selectedSlot.start}
          onchange={(e) => updateSlotTime("start", e.currentTarget.value)}
        />
      </div>
      <div class="flex flex-col gap-1">
        <Label for="slot-end" class="text-xs">To</Label>
        <Input
          id="slot-end"
          type="time"
          class="h-8 w-32 px-2 py-1"
          value={selectedSlot.end}
          onchange={(e) => updateSlotTime("end", e.currentTarget.value)}
        />
      </div>
      <Button size="sm" variant="ghost" onclick={removeTimeSlot}><Trash2 /> Remove this slot</Button
      >
    </div>
    {#if problem}
      <div class="mt-2 text-sm text-destructive">
        <TriangleAlert class="mb-1 inline" size={16} />
        {problem}
      </div>
    {:else if parseInt(selectedSlot.end) < parseInt(selectedSlot.start)}
      <div class="mt-2 text-xs text-muted-foreground">Crosses midnight.</div>
    {/if}
  {/if}
</div>

<div class="mb-5">
  <h4 class="scroll-m-20 text-xl font-semibold tracking-tight">
    {selectedSlot ? `Rows from ${selectedSlot.start} to ${selectedSlot.end}` : "Default rows"}
  </h4>
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
          value={row.customName}
          oninput={(e) => setCustomName(row, e.currentTarget.value)}
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
      {#if selectedSlot}
        No rows in this time slot yet: the display stays dark from {selectedSlot.start} to {selectedSlot.end}.
      {:else if $config.timeSlots.length > 0}
        No default rows: outside the time slots, the display stays dark.
      {:else}
        No rows yet. Add a transit line or a Vélo'v station to get started.
      {/if}
    </div>
  {/if}

  {#if storageUsed > 0.8}
    <div class="mb-3 text-xs {storageUsed > 1 ? 'text-destructive' : 'text-muted-foreground'}">
      {storageUsed > 1
        ? "Too many rows to save on the display. Remove a few, starting with the ones that are not shown."
        : `The display's row storage is ${Math.round(storageUsed * 100)}% full.`}
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
