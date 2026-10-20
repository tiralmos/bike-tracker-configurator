<script lang="ts">
  import { config, getWebSocketEndpoint } from "$lib/state"
  import * as YAML from "json-to-pretty-yaml"
  import { Button } from "../ui/button"
  import { toast } from "svelte-sonner"
  import { ClipboardCopy } from "@lucide/svelte"

  function generateYaml() {
    const generatedConfig = {
      bike_tracker: {
        base_url: getWebSocketEndpoint($config.apiBaseUrl),
        scroll_station_names: $config.nameOverflow === "scroll",
        ...($config.headerText ? { header_text: $config.headerText } : {}),
        stations: $config.stations.map((s) => ({
          station_id: s.stationId,
          ...(s.customName.trim() ? { name: s.customName.trim() } : {})
        })),
        abbreviations: $config.abbreviations.map((a) => ({
          from: a.from,
          to: a.to
        }))
      }
    }

    return YAML.stringify(generatedConfig)
  }

  async function copyYaml() {
    try {
      await navigator.clipboard.writeText(generateYaml())
      toast.success("YAML copied to clipboard")
    } catch (e: any) {
      toast.error("Failed to copy YAML to clipboard", {
        description: e.message || "An unknown error occurred"
      })
      throw e
    }
  }
</script>

<Button onclick={copyYaml}>
  <ClipboardCopy />
  Copy to clipboard
</Button>

<pre class="text-xs">{generateYaml()}</pre>
