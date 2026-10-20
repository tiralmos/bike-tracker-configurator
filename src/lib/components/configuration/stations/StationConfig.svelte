<script lang="ts">
  import { Pencil, TriangleAlert } from "@lucide/svelte"
  import { Button } from "../../ui/button"
  import { Label } from "../../ui/label"
  import * as RadioGroup from "../../ui/radio-group"
  import StationChooser from "./StationChooser.svelte"
  import { config, isLoopbackUrl, type SelectedStation } from "$lib/state"
  import { scale } from "svelte/transition"
  import { pluralize } from "$lib/utils"
  import { goto } from "$app/navigation"

  let showStationEditor = $state(false)

  let stationsCount = $derived($config.stations.length)

  function saveStations(stations: SelectedStation[]) {
    $config.stations = stations
    showStationEditor = false
  }
</script>

{#if showStationEditor}
  <div
    class="fixed left-0 top-0 z-50 h-full w-full bg-background"
    transition:scale={{ duration: 300, start: 0.9 }}
  >
    <StationChooser onsave={saveStations} config={$config} />
  </div>
{/if}

{#if isLoopbackUrl($config.apiBaseUrl)}
  <div
    class="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
  >
    <TriangleAlert class="mb-1 inline" size={16} />
    The API server is set to <code>{$config.apiBaseUrl}</code>, which your display cannot reach. Set
    it to your computer's address on your network (for example
    <code>http://192.168.1.10:3000</code>) in the
    <Button variant="link" size="small" onclick={() => goto("./advanced")}>Advanced</Button> tab.
  </div>
{/if}

<div class="mb-5">
  <h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Selected Stations</h4>
  <div class="mb-2 text-sm text-muted-foreground">
    Displaying {stationsCount}
    {pluralize(stationsCount, "station", "stations")}{#if stationsCount > 0}:
      {$config.stations.map((s) => s.customName || s.name).join(", ")}{/if}.
  </div>

  <Button size="sm" variant="secondary" onclick={() => (showStationEditor = true)}>
    <Pencil />
    Edit stations
  </Button>
</div>

<div class="mb-5">
  <h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Long Station Names</h4>
  <div class="mb-2 text-sm text-muted-foreground">
    Change how station names are displayed when they don't fit next to the bike counts.
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
