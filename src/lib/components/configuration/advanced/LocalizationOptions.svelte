<script lang="ts">
  import type { ConfigState, Localization } from "$lib/state"
  import { Label } from "$lib/components/ui/label"
  import { Input } from "$lib/components/ui/input"

  interface Props {
    configState: ConfigState
    onsave: (localization: Localization) => void
  }

  let { configState, onsave }: Props = $props()

  let localization = $derived(configState.localization)

  function updateLocalization(field: keyof Localization, value: string) {
    onsave({ ...localization, [field]: value })
  }
</script>

{#snippet localizationField(field: keyof Localization, label: string, placeholder: string)}
  <div class="flex flex-col gap-2">
    <Label for={field} class="flex items-center gap-2">{label}</Label>
    <Input
      {placeholder}
      value={localization[field]}
      oninput={(e) => updateLocalization(field, e.currentTarget.value)}
      name={field}
      id={field}
    />
  </div>
{/snippet}

<div class="grid grid-cols-2 gap-3">
  {@render localizationField("now", "Now Label", "Now")}
  {@render localizationField("hoursShort", "Hours Short Label", "h")}
  {@render localizationField("minLong", "Minutes Long Label", "min")}
  {@render localizationField("minShort", "Minutes Short Label", "m")}
</div>
