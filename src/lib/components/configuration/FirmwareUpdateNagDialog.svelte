<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog"
  import { Button } from "$lib/components/ui/button"
  import FirmwareFlasher from "$lib/components/setup/FirmwareFlasher.svelte"
  import { FIRMWARE_BIN_URL, releaseNotesUrl } from "$lib/firmware"
  import { Clipboard } from "@lucide/svelte"

  interface Props {
    open: boolean
    currentVersion: string | null
    latestVersion: string
    isUsbConnected: boolean
  }

  let { open = $bindable(), currentVersion, latestVersion, isUsbConnected }: Props = $props()

  function dismiss() {
    sessionStorage.setItem(`firmware-update-nag-dismissed-${latestVersion}`, "1")
    open = false
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Firmware update available</Dialog.Title>
      <Dialog.Description
        >Get the latest features and bug fixes for your Bike Tracker.</Dialog.Description
      >
    </Dialog.Header>

    <p class="my-2 text-center text-lg font-medium leading-6">
      {#if currentVersion}
        {currentVersion}
      {:else}
        <span class="italic text-muted-foreground">unknown</span>
      {/if}
      <span class="mx-2 text-gray-400">→</span>
      {latestVersion}
    </p>

    <Button
      variant="secondary"
      class="mb-3 w-full"
      href={releaseNotesUrl(latestVersion)}
      target="_blank"
    >
      <Clipboard /> View release notes
    </Button>

    {#if isUsbConnected}
      <FirmwareFlasher
        file={FIRMWARE_BIN_URL}
        offset={0x10000}
        eraseFlash={false}
        bootButtonRequired={false}
        onSuccess={() => {
          open = false
        }}
      />
    {:else}
      <Button
        class="w-full"
        href="https://github.com/tiralmos/bike-tracker/releases"
        target="_blank"
      >
        Update firmware
      </Button>
    {/if}

    <Dialog.Footer class="mt-3">
      <Button variant="ghost" onclick={dismiss}>Not now</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
