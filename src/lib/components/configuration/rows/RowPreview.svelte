<script lang="ts">
  import { api, type StationStatus, type Trip as ApiTrip } from "$lib/api"
  import { config, isSameRouteAtStop, rowId, type DisplayRow } from "$lib/state"
  import TrackerSimulator from "$lib/components/simulator/TrackerSimulator.svelte"
  import { hexColor, type Color, type SimulatorRow } from "$lib/components/simulator/simulator"
  import { onDestroy } from "svelte"

  interface Props {
    rows: DisplayRow[]
    /** Travel time to each stop, in minutes */
    timeOffsets?: Record<string, number>
  }

  let { rows, timeOffsets = $config.stopTimeOffsets }: Props = $props()

  const DEFAULT_ROUTE_COLOR = hexColor(0x028e51)
  const REFRESH_MS = 30_000

  let trips: ApiTrip[] = $state([])
  let stations: StationStatus[] = $state([])
  let now = $state(Math.floor(Date.now() / 1000))

  function abbreviate(text: string) {
    let result = text
    for (const abbr of $config.abbreviations) {
      if (abbr.from) result = result.replace(abbr.from, abbr.to)
    }
    return result
  }

  function parseColor(hex: string | null | undefined): Color | null {
    if (!hex) return null
    const value = parseInt(hex.replace("#", ""), 16)
    return Number.isNaN(value) ? null : hexColor(value)
  }

  function offsetSeconds(stopId: string) {
    return (timeOffsets[stopId] ?? 0) * -60
  }

  let pairs = $derived(
    [
      ...new Set(
        rows.flatMap((row) => (row.kind === "transit" ? [`${row.routeId},${row.stopId}`] : []))
      )
    ].join(";")
  )

  let stationIds = $derived(
    [...new Set(rows.flatMap((row) => (row.kind === "bike" ? [row.stationId] : [])))].join(";")
  )

  async function refresh() {
    now = Math.floor(Date.now() / 1000)
    try {
      trips = pairs ? (await api.getSchedule(pairs, 20)).trips : []
    } catch (error) {
      console.error("Could not load departures for the preview:", error)
    }
    try {
      stations = stationIds ? await api.getStations(stationIds.split(";")) : []
    } catch (error) {
      console.error("Could not load stations for the preview:", error)
    }
  }

  $effect(() => {
    // Reload when the selection changes
    void pairs
    void stationIds
    refresh()
  })

  const timer = setInterval(refresh, REFRESH_MS)
  onDestroy(() => clearInterval(timer))

  // Same logic as the firmware: each transit row takes the next departure of
  // its line at its stop; a repeated line takes the one after.
  let simulatorRows: SimulatorRow[] = $derived(
    rows.map((row, index): SimulatorRow => {
      if (row.kind === "bike") {
        const status = stations.find((s) => s.stationId === row.stationId) ?? null
        return {
          kind: "bike",
          name: row.customName.trim() || abbreviate(status?.name ?? row.name),
          station: status && {
            stationId: status.stationId,
            name: status.name,
            docksAvailable: status.docksAvailable,
            mechanicalBikesAvailable: status.mechanicalBikesAvailable,
            electricBikesAvailable: status.electricBikesAvailable,
            isRenting: status.isInstalled && status.isRenting,
            isReturning: status.isInstalled && status.isReturning
          }
        }
      }

      const style = $config.routeStyles.find((s) => s.routeId === row.routeId)
      const routeColor = parseColor(style?.color) ?? parseColor(row.color) ?? DEFAULT_ROUTE_COLOR
      const routeName = style?.name || row.routeName

      const occurrence = rows
        .slice(0, index)
        .filter((other) => other.kind === "transit" && rowId(other) === rowId(row)).length

      const offset = offsetSeconds(row.stopId)
      const timeKey = $config.timeDisplay === "departure" ? "departureTime" : "arrivalTime"
      const upcoming = trips
        .filter((trip) => isSameRouteAtStop(trip, row))
        .map((trip) => ({
          ...trip,
          arrivalTime: trip.arrivalTime + offset,
          departureTime: trip.departureTime + offset
        }))
        .filter((trip) => trip[timeKey] >= now)
        .sort((a, b) => a[timeKey] - b[timeKey])

      const trip = upcoming[occurrence] ?? null

      return {
        kind: "transit",
        routeName,
        routeColor,
        customName: row.customName.trim() || undefined,
        trip: trip && {
          routeName,
          routeColor: parseColor(style?.color) ?? parseColor(trip.routeColor) ?? routeColor,
          headsign: abbreviate(trip.headsign),
          arrivalTime: trip.arrivalTime,
          departureTime: trip.departureTime,
          isRealtime: trip.isRealtime
        }
      }
    })
  )
</script>

<div class="flex min-h-24 w-full items-center justify-center">
  <div class="simulator">
    {#key `${$config.headerText}|${$config.nameOverflow}|${$config.timeUnits}|${$config.timeDisplay}`}
      <TrackerSimulator
        rows={simulatorRows}
        options={{
          brightness: 1.3,
          pixelPitch: 8,
          glowRadius: 16,
          headerText: $config.headerText,
          scrollNames: $config.nameOverflow === "scroll",
          unitDisplay: $config.timeUnits,
          displayDepartureTimes: $config.timeDisplay === "departure",
          timeStrings: $config.localization
        }}
        class="w-full"
      />
    {/key}
  </div>
</div>

<style>
  .simulator {
    border: 1.5vw solid #0b0b0b;
    border-radius: 10px;
  }
</style>
