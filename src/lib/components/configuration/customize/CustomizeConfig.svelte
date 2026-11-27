<script lang="ts">
  import { Input } from "$lib/components/ui/input"
  import { Label } from "$lib/components/ui/label"
  import { Checkbox } from "$lib/components/ui/checkbox"
  import { config, type Abbreviation, type RouteStyle } from "$lib/state"
  import AbbreviationOptions from "./AbbreviationOptions.svelte"
  import RouteStyleOptions from "./RouteStyleOptions.svelte"

  /** The brightness options of the firmware */
  const BRIGHTNESS_STEPS = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

  function brightnessIndex(value: number | null) {
    const index = BRIGHTNESS_STEPS.indexOf(value ?? 100)
    return index === -1 ? BRIGHTNESS_STEPS.length - 1 : index
  }

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

<div class="mb-5">
  <h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Brightness</h4>
  <div class="mb-2 flex flex-col text-sm text-muted-foreground">
    The brightness the display starts at, saved with the configuration. The buttons on the display
    still change it until the next restart.
  </div>

  <div class="flex flex-col gap-3">
    <div class="flex items-center space-x-2">
      <Checkbox
        id="brightness-set"
        checked={$config.brightness !== null}
        onCheckedChange={(checked) => ($config.brightness = checked ? 50 : null)}
      />
      <Label for="brightness-set">Set the brightness</Label>
    </div>
    {#if $config.brightness !== null}
      <div class="flex items-center gap-3">
        <input
          type="range"
          class="w-full max-w-sm accent-primary"
          aria-label="Brightness"
          min="0"
          max={BRIGHTNESS_STEPS.length - 1}
          step="1"
          value={brightnessIndex($config.brightness)}
          oninput={(e) => ($config.brightness = BRIGHTNESS_STEPS[Number(e.currentTarget.value)])}
        />
        <span class="w-12 text-right text-sm tabular-nums">{$config.brightness}%</span>
      </div>
    {/if}
  </div>
</div>

<div class="mb-5">
  <h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Extras</h4>
  <div class="mb-2 flex flex-col text-sm text-muted-foreground">
    Optional information on the display. The preview on the Rows tab shows them with live data.
  </div>

  <div class="flex flex-col gap-3">
    <div class="flex items-start space-x-2">
      <Checkbox id="extra-alerts" bind:checked={$config.alerts} />
      <div class="grid gap-1">
        <Label for="extra-alerts">Disruption alerts</Label>
        <span class="text-sm text-muted-foreground">
          A line with an alert gets a "!" after its name: red when it does not run, yellow when it
          is disrupted, light blue for information. Every 45 seconds or so the alert replaces the
          destination and scrolls once.
        </span>
      </div>
    </div>
    <div class="flex items-start space-x-2">
      <Checkbox
        id="extra-logo"
        checked={$config.logoColor === "temperature"}
        onCheckedChange={(checked) => ($config.logoColor = checked ? "temperature" : "red")}
      />
      <div class="grid gap-1">
        <Label for="extra-logo">Vélo'v logo colored by temperature</Label>
        <span class="text-sm text-muted-foreground">
          Icy blue below 0 °C, blue up to 9 °C, green up to 19 °C, orange up to 27 °C, red from 28
          °C.
        </span>
      </div>
    </div>
    <div class="flex items-start space-x-2">
      <Checkbox id="extra-weather" bind:checked={$config.weather} />
      <div class="grid gap-1">
        <Label for="extra-weather">Weather</Label>
        <span class="text-sm text-muted-foreground">
          An icon and the temperature on the first Vélo'v row, for the place of its station (from
          Open-Meteo).
        </span>
      </div>
    </div>
  </div>
</div>
