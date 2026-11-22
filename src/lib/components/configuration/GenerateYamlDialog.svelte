<script lang="ts">
  import { config, getWebSocketEndpoint } from "$lib/state"
  import * as YAML from "json-to-pretty-yaml"
  import { Button } from "../ui/button"
  import { toast } from "svelte-sonner"
  import { ClipboardCopy } from "@lucide/svelte"

  function generateYaml() {
    const distinctColorsUsed = [
      ...new Set($config.routeStyles.map((s) => s.color.replaceAll("#", "")))
    ]

    const generatedConfig = {
      ...(distinctColorsUsed.length > 0
        ? { color: distinctColorsUsed.map((c) => ({ id: `c_${c}`, hex: c })) }
        : {}),
      transit_tracker: {
        base_url: getWebSocketEndpoint($config.apiBaseUrl),
        time_display: $config.timeDisplay,
        show_units: $config.timeUnits,
        scroll_names: $config.nameOverflow === "scroll",
        ...($config.headerText ? { header_text: $config.headerText } : {}),
        rows: $config.rows.map((row) => {
          const name = row.customName.trim() ? { name: row.customName.trim() } : {}
          if (row.kind === "bike") return { station_id: row.stationId, ...name }
          const travelMinutes = $config.stopTimeOffsets[row.stopId] ?? 0
          return {
            route_id: row.routeId,
            stop_id: row.stopId,
            ...(travelMinutes ? { time_offset: `${-travelMinutes}min` } : {}),
            ...name
          }
        }),
        abbreviations: $config.abbreviations.map((a) => ({
          from: a.from,
          to: a.to
        })),
        styles: $config.routeStyles.map((style) => ({
          route_id: style.routeId,
          name: style.name,
          color: `c_${style.color.replaceAll("#", "")}`
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
