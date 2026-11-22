<script lang="ts">
  import { Label } from "$lib/components/ui/label"
  import * as RadioGroup from "$lib/components/ui/radio-group"
  import { Cable, FlaskConical, Usb, Wifi } from "@lucide/svelte"
  import { Button } from "../ui/button"
  import { Input } from "../ui/input"
  import { Checkbox } from "../ui/checkbox"
  import type { DeviceConnection } from "$lib/state"
  import { defaultFakeDeviceOptions, type FakeDeviceOptions } from "$lib/device/fake-device"

  const DEV = import.meta.env.DEV

  interface Props {
    onSuccess?: (deviceConnection: DeviceConnection) => void
  }

  let { onSuccess }: Props = $props()

  let connectionType: "usb" | "network" | "fake" = $state("usb")
  let ipAddress = $state("")
  let connecting = $state(false)

  let fakeOptions: FakeDeviceOptions = $state({ ...defaultFakeDeviceOptions })
  let fakeVersionInput = $state("")

  const browserSupportsWebSerial = "serial" in navigator

  function connectUsb() {
    onSuccess?.({ type: "usb" })
  }

  async function connectNetwork() {
    const baseUrl = new URL(`http://${ipAddress}`)
    onSuccess?.({ type: "network", baseUrl: baseUrl.origin })
  }

  function connectFake() {
    onSuccess?.({
      type: "fake",
      fakeOptions: {
        ...fakeOptions,
        projectVersion: fakeVersionInput.trim() || null
      }
    })
  }
</script>

<RadioGroup.Root
  bind:value={connectionType}
  class="grid gap-4 {DEV ? 'grid-cols-3' : 'grid-cols-2'}"
>
  <div>
    <RadioGroup.Item value="usb" id="usb" class="peer sr-only" />
    <Label
      for="usb"
      class="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
    >
      <Usb class="mb-3 h-6 w-6" />
      Connect via USB
    </Label>
  </div>
  <div>
    <RadioGroup.Item value="network" id="network" class="peer sr-only" />
    <Label
      for="network"
      class="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
    >
      <Wifi class="mb-3 h-6 w-6" />
      Connect via Network
    </Label>
  </div>
  {#if DEV}
    <div>
      <RadioGroup.Item value="fake" id="fake" class="peer sr-only" />
      <Label
        for="fake"
        class="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
      >
        <FlaskConical class="mb-3 h-6 w-6" />
        Fake device
      </Label>
    </div>
  {/if}
</RadioGroup.Root>

{#if connectionType === "usb"}
  {#if browserSupportsWebSerial}
    <Button class="flex-grow" disabled={connecting} onclick={connectUsb}>
      <Cable /> Connect via USB
    </Button>
  {:else}
    Your browser does not support connecting to devices via USB. Please use a Chromium-based browser
    like Google Chrome or Microsoft Edge, or connect to your Transit Tracker via the network.
  {/if}
{/if}

{#if connectionType === "network"}
  <div class="flex flex-col gap-2">
    <Label for="ip">IP address</Label>
    <Input placeholder="127.0.0.1" bind:value={ipAddress} name="ip" id="ip" />
  </div>

  <Button class="flex-grow" onclick={connectNetwork} disabled={!ipAddress || connecting}>
    <Cable /> Connect using IP
  </Button>
{/if}

{#if connectionType === "fake"}
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-2">
      <Label for="fake-version">Firmware version</Label>
      <Input
        placeholder="null (no version reported)"
        bind:value={fakeVersionInput}
        name="fake-version"
        id="fake-version"
      />
    </div>

    <div class="flex items-center gap-2">
      <Checkbox id="fake-failures" bind:checked={fakeOptions.simulateFailures} />
      <Label for="fake-failures">Simulate entity write failures</Label>
    </div>
  </div>

  <Button class="flex-grow" onclick={connectFake}>
    <FlaskConical /> Use fake device
  </Button>
{/if}
