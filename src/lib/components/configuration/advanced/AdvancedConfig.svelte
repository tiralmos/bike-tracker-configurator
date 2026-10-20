<script lang="ts">
  import * as RadioGroup from "../../ui/radio-group"
  import { Label } from "../../ui/label"
  import { config } from "$lib/state"
  import { Button } from "../../ui/button"
  import { ClipboardCopy, ClipboardPaste, Pencil } from "@lucide/svelte"
  import ChangeHostDialog from "./ChangeHostDialog.svelte"
  import * as Dialog from "$lib/components/ui/dialog"
  import { toast } from "svelte-sonner"

  let showChangeHostDialog = $state(false)

  function saveApiBaseUrl(newUrl: string) {
    if ($config.apiBaseUrl !== newUrl) {
      $config.stations = []
    }

    $config.apiBaseUrl = newUrl
    showChangeHostDialog = false
  }

  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(JSON.stringify($config))
      toast.success("Configuration copied to clipboard")
    } catch (e: any) {
      toast.error("Failed to copy configuration to clipboard", {
        description: e.message || "An unknown error occurred"
      })
    }
  }

  function pasteConfig() {
    const text = prompt(
      "NOTE: This will override any settings you have configured.\n\nPaste your configuration JSON here:"
    )
    if (text) {
      try {
        const parsedConfig = JSON.parse(text)
        $config = { ...$config, ...parsedConfig }
        toast.success("Configuration pasted from clipboard")
      } catch (e: any) {
        console.error("Failed to paste configuration from clipboard", e)
        toast.error("Failed to paste configuration from clipboard", {
          description: e.message || "An unknown error occurred"
        })
      }
    }
  }
</script>

<Dialog.Root bind:open={showChangeHostDialog}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Change API server</Dialog.Title>
      <Dialog.Description>
        <span class="font-bold text-orange-500 dark:text-yellow-500">Warning</span>: Changing the
        API server will clear selected stations.
      </Dialog.Description>
    </Dialog.Header>

    <ChangeHostDialog onSuccess={saveApiBaseUrl} />
  </Dialog.Content>
</Dialog.Root>

<div class="mb-5">
  <h4 class="scroll-m-20 text-xl font-semibold tracking-tight">API Server</h4>
  <div class="mb-2 text-sm text-muted-foreground">
    The Bike Tracker API server running on your computer. Use your computer's address on your
    network (for example <code>http://192.168.1.10:3000</code>), not <code>localhost</code>, so that
    your display can reach it too.
  </div>
  <div class="mb-2 text-sm">Currently: <code>{$config.apiBaseUrl}</code></div>

  <Button size="sm" variant="secondary" onclick={() => (showChangeHostDialog = true)}>
    <Pencil />
    Change API server
  </Button>
</div>

<div class="mb-5">
  <h4 class="mb-1 scroll-m-20 text-xl font-semibold tracking-tight">Display Orientation</h4>

  <div class="mb-2 text-sm text-muted-foreground">
    This option has no effect starting with firmware version 2.7.0; orientation is automatically
    detected with the accelerometer.
  </div>

  <RadioGroup.Root bind:value={$config.displayOrientation}>
    <div class="flex items-center space-x-2">
      <RadioGroup.Item value="normal" id="normal" />
      <Label for="normal">Normal &mdash; USB port on the right</Label>
    </div>
    <div class="flex items-center space-x-2">
      <RadioGroup.Item value="flipped" id="flipped" />
      <Label for="flipped">Flipped &mdash; USB port on the left</Label>
    </div>
  </RadioGroup.Root>
</div>

<div class="mb-5">
  <h4 class="mb-3 scroll-m-20 text-xl font-semibold tracking-tight">Tools</h4>

  <div class="mb-3">
    <Button size="sm" onclick={copyConfig}>
      <ClipboardCopy />
      Copy raw configuration
    </Button>
  </div>

  <div>
    <Button size="sm" variant="destructive" onclick={pasteConfig}>
      <ClipboardPaste />
      Paste raw configuration
    </Button>
  </div>
</div>
