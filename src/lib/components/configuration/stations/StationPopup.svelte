<script lang="ts">
  import { api, type StationListEntry, type StationStatus } from "$lib/api"
  import { Button } from "$lib/components/ui/button"
  import { Popup } from "svelte-maplibre"
  import { onMount } from "svelte"
  import Skeleton from "../../Skeleton.svelte"

  interface Props {
    station: StationListEntry
    selected: boolean
    disabled?: boolean
    onadd: (station: StationListEntry) => void
    onremove: (station: StationListEntry) => void
    onclose: () => void
  }

  const { station, selected, disabled = false, onadd, onremove, onclose }: Props = $props()

  let open = $state(true)
  let status: StationStatus | null = $state(null)
  let error: string | null = $state(null)

  onMount(async () => {
    try {
      ;[status] = await api.getStations([station.stationId])
    } catch (err: any) {
      error = err.message
    }
  })

  $effect(() => {
    if (!open) onclose()
  })
</script>

<Popup bind:open openOn="manual" lngLat={[station.lon, station.lat]} popupClass="p-0">
  <div class="min-w-48 bg-background px-4 py-3 text-foreground">
    <h4 class="mb-2 text-lg font-semibold tracking-tight">{station.name}</h4>

    {#if error}
      <div class="mb-2 text-sm text-red-500">Could not load availability: {error}</div>
    {:else if status}
      <ul class="mb-3 text-sm">
        <li>Free docks: <strong>{status.docksAvailable}</strong></li>
        <li>Mechanical bikes: <strong>{status.mechanicalBikesAvailable}</strong></li>
        <li>Electric bikes: <strong>{status.electricBikesAvailable}</strong></li>
        {#if !status.isRenting || !status.isInstalled}
          <li class="text-orange-500">This station is currently closed.</li>
        {/if}
      </ul>
    {:else}
      <div class="mb-3"><Skeleton /></div>
    {/if}

    {#if selected}
      <Button size="sm" variant="secondary" class="w-full" onclick={() => onremove(station)}>
        Remove from display
      </Button>
    {:else}
      <Button size="sm" class="w-full" {disabled} onclick={() => onadd(station)}>
        Add to display
      </Button>
    {/if}
  </div>
</Popup>

<style>
  :global(.maplibregl-popup-content) {
    @apply bg-background p-0 text-foreground;
  }

  :global(.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) {
    @apply border-t-background;
  }

  :global(.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
    @apply border-r-background;
  }

  :global(.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
    @apply border-l-background;
  }

  :global(.maplibregl-popup-anchor-top .maplibregl-popup-tip) {
    @apply border-b-background;
  }
</style>
