<script lang="ts">
  import { api, type StationStatus } from "$lib/api"
  import { config, type SelectedStation } from "$lib/state"
  import BikeTrackerSimulator from "$lib/components/simulator/BikeTrackerSimulator.svelte"
  import type { Station as SimStation } from "$lib/components/simulator/simulator"

  interface Props {
    stations: SelectedStation[]
  }

  let { stations }: Props = $props()

  const abbreviations = $config.abbreviations
  const headerText = $config.headerText
  const scrollStationNames = $config.nameOverflow === "scroll"

  let statuses: StationStatus[] = $state([])

  let simulatorStations: SimStation[] = $derived(
    stations.flatMap((selected) => {
      const status = statuses.find((s) => s.stationId === selected.stationId)
      if (!status) return []

      let name = status.name
      for (const abbr of abbreviations) {
        name = name.replace(abbr.from, abbr.to)
      }

      return [
        {
          stationId: status.stationId,
          name: selected.customName.trim() || name,
          docksAvailable: status.docksAvailable,
          mechanicalBikesAvailable: status.mechanicalBikesAvailable,
          electricBikesAvailable: status.electricBikesAvailable,
          isRenting: status.isInstalled && status.isRenting,
          isReturning: status.isInstalled && status.isReturning
        }
      ]
    })
  )

  let stationIds = $derived(stations.map((s) => s.stationId).join(";"))

  $effect(() => {
    if (stationIds) {
      api.getStations(stationIds.split(";")).then((result) => (statuses = result))
    }
  })
</script>

<div class="flex min-h-24 w-full items-center justify-center">
  <div class="simulator">
    <BikeTrackerSimulator
      stations={simulatorStations}
      options={{
        brightness: 1.3,
        pixelPitch: 8,
        glowRadius: 16,
        headerText,
        scrollStationNames
      }}
      class="w-full"
    />
  </div>
</div>

<style>
  .simulator {
    border: 1.5vw solid #0b0b0b;
    border-radius: 10px;
  }
</style>
