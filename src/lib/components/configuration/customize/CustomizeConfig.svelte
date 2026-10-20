<script lang="ts">
  import { Input } from "$lib/components/ui/input"
  import { Label } from "$lib/components/ui/label"
  import { config, type Abbreviation } from "$lib/state"
  import AbbreviationOptions from "./AbbreviationOptions.svelte"

  function saveAbbreviations(abbreviations: Abbreviation[]) {
    $config.abbreviations = abbreviations
  }
</script>

<div class="mb-5">
  <h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Abbreviations</h4>
  <div class="mb-2 flex flex-col text-sm text-muted-foreground">
    Shorten station names so they fit better on the screen. For example, you can abbreviate
    "PART-DIEU" to "P-DIEU". A name you give a station yourself is shown as-is.
  </div>

  <AbbreviationOptions configState={$config} onsave={saveAbbreviations} />
</div>

<div class="mb-5">
  <h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Header Text</h4>
  <div class="mb-2 flex flex-col text-sm text-muted-foreground">
    Show a static piece of text at the top of the display, for example "Vélo'v". It takes the place
    of one station row.
  </div>

  <div class="flex flex-col gap-2">
    <Input bind:value={$config.headerText} name="headerText" id="headerText" />
  </div>
</div>
