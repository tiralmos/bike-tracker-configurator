<script lang="ts">
  import { pushConfigToDevice } from "$lib/device"
  import { config, deviceConnection } from "$lib/state"
  import { toast } from "svelte-sonner"
  import { Button } from "../ui/button"
  import { LoaderCircle, Upload } from "@lucide/svelte"
  import { goto } from "$app/navigation"
  import { UsbTransitTrackerDevice } from "$lib/device/usb-device"
  import type { TransitTrackerDevice } from "$lib/device/transit-tracker-device"
  import { NetworkTransitTrackerDevice } from "$lib/device/network-device"
  import { FakeTransitTrackerDevice } from "$lib/device/fake-device"
  import { getSerialContext } from "$lib/serial-context"
  import { onDestroy } from "svelte"
  import FirmwareUpdateNagDialog from "./FirmwareUpdateNagDialog.svelte"
  import { getLatestFirmwareVersion, isUpdateAvailable } from "$lib/firmware"

  const ctx = getSerialContext()

  let pushing = $state(false)
  let device: TransitTrackerDevice | null = null

  let showUpdateNag = $state(false)
  let nagCurrentVersion = $state<string | null>(null)
  let nagLatestVersion = $state("")

  async function checkFirmwareUpdate(deviceVersion: string | null) {
    try {
      const version = await getLatestFirmwareVersion()
      const sessionKey = `firmware-update-nag-dismissed-${version}`

      if (isUpdateAvailable(deviceVersion, version) && !sessionStorage.getItem(sessionKey)) {
        nagCurrentVersion = deviceVersion
        nagLatestVersion = version
        showUpdateNag = true
      }
    } catch {
      // silently ignore
    }
  }

  async function pushConfig() {
    if ($deviceConnection.type === "usb") {
      device = UsbTransitTrackerDevice.getInstance(ctx)
    } else if ($deviceConnection.type === "network") {
      device = new NetworkTransitTrackerDevice($deviceConnection.baseUrl!)
    } else if ($deviceConnection.type === "fake") {
      device = new FakeTransitTrackerDevice($deviceConnection.fakeOptions)
    } else {
      toast.error("No device connected")
      return
    }

    pushing = true
    try {
      const { results, deviceVersion } = await pushConfigToDevice($config, device)

      const errors = results.filter((result) => !result)
      if (errors.length > 0) {
        toast.warning("Unable to push full config", {
          description: "Your Transit Tracker may need a firmware update.",
          duration: 10000,
          action: {
            label: "Update Firmware",
            onClick() {
              goto("/update")
            }
          }
        })
      } else {
        toast.success("Configuration saved successfully")
        checkFirmwareUpdate(deviceVersion)
      }
    } catch (e: any) {
      if (e.name === "ConfigValidationError") {
        toast.error("Validation failed", {
          description: e.message,
          duration: 10000
        })
        return
      }

      toast.error("Failed to save configuration", {
        description: e.message,
        duration: 10000
      })
    } finally {
      pushing = false
      await device?.close?.()
    }
  }

  onDestroy(async () => {
    await device?.close?.()
  })
</script>

<FirmwareUpdateNagDialog
  bind:open={showUpdateNag}
  currentVersion={nagCurrentVersion}
  latestVersion={nagLatestVersion}
  isUsbConnected={$deviceConnection.type === "usb"}
/>

<Button class="flex-grow" onclick={pushConfig} disabled={pushing}>
  {#if pushing}
    <LoaderCircle class="animate-spin" />
    Saving configuration...
  {:else}
    <Upload /> Save configuration to device
  {/if}
</Button>
