<script lang="ts">
  import { TrackerSimulator, type SimulatorOptions, type SimulatorRow } from "./simulator"

  let {
    rows = [],
    options = {},
    class: className = ""
  }: {
    rows?: SimulatorRow[]
    options?: SimulatorOptions
    class?: string
  } = $props()

  let canvas: HTMLCanvasElement | undefined = $state()
  let simulator: TrackerSimulator | undefined = $state()

  $effect(() => {
    if (!canvas) return
    const sim = new TrackerSimulator(canvas, options)
    sim.start()
    simulator = sim
    return () => sim.stop()
  })

  $effect(() => {
    simulator?.setRows(rows)
  })

  function describe(row: SimulatorRow) {
    if (row.kind === "bike") {
      if (!row.station) return `${row.name}: no data`
      const s = row.station
      return `${row.name}: ${s.docksAvailable} free docks, ${s.mechanicalBikesAvailable} mechanical bikes, ${s.electricBikesAvailable} electric bikes`
    }
    const name = row.customName || row.trip?.headsign || "no departures"
    return `${row.trip?.routeName ?? row.routeName} ${name}`
  }
</script>

<canvas
  bind:this={canvas}
  class={className}
  aria-label={rows.length === 0 ? "No rows configured" : rows.map(describe).join("; ")}
></canvas>
