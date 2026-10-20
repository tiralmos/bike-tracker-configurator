<script lang="ts">
  import { BikeTrackerSimulator, type SimulatorOptions, type Station } from "./simulator"

  let {
    stations = [],
    options = {},
    class: className = ""
  }: {
    stations?: Station[]
    options?: SimulatorOptions
    class?: string
  } = $props()

  let canvas: HTMLCanvasElement | undefined = $state()
  let simulator: BikeTrackerSimulator | undefined = $state()

  $effect(() => {
    if (!canvas) return
    const sim = new BikeTrackerSimulator(canvas, options)
    sim.start()
    simulator = sim
    return () => sim.stop()
  })

  $effect(() => {
    simulator?.setStations(stations)
  })
</script>

<canvas
  bind:this={canvas}
  class={className}
  aria-label={stations.length === 0
    ? "No stations selected"
    : stations
        .map(
          (s) =>
            `${s.name}: ${s.docksAvailable} free docks, ${s.mechanicalBikesAvailable} mechanical bikes, ${s.electricBikesAvailable} electric bikes`
        )
        .join("; ")}
></canvas>
