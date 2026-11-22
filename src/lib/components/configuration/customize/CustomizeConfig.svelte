<script lang="ts">
  import { Input } from "$lib/components/ui/input"
  import { Label } from "$lib/components/ui/label"
  import { config, type Abbreviation, type RouteStyle } from "$lib/state"
  import AbbreviationOptions from "./AbbreviationOptions.svelte"
  import RouteStyleOptions from "./RouteStyleOptions.svelte"

  function saveAbbreviations(abbreviations: Abbreviation[]) {
    $config.abbreviations = abbreviations
  }

  function saveRouteStyles(routeStyles: RouteStyle[]) {
    $config.routeStyles = routeStyles
  }
</script>

<div class="mb-5">
  <h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Abbreviations</h4>
  <div class="mb-2 flex flex-col text-sm text-muted-foreground">
    Shorten destinations and station names so they fit better on the screen. For example, you can
    abbreviate "Part-Dieu" to "P-Dieu". A name you give a row yourself is shown as-is.
  </div>

  <AbbreviationOptions configState={$config} onsave={saveAbbreviations} />
</div>

<div class="mb-5">
  <h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Line Styles</h4>
  <div class="mb-2 flex flex-col text-sm text-muted-foreground">
    Customize the names and colors of the transit lines on your rows.
  </div>

  <RouteStyleOptions configState={$config} onsave={saveRouteStyles} />
</div>

<div class="mb-5">
  <h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Header Text</h4>
  <div class="mb-2 flex flex-col text-sm text-muted-foreground">
    Show a static piece of text at the top of the display, for example "Lyon". It takes the place of
    one row.
  </div>

  <div class="flex flex-col gap-2">
    <Input bind:value={$config.headerText} name="headerText" id="headerText" />
  </div>
</div>
