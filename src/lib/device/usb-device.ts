import {
  ConfigValidationError,
  type SetEntityResult,
  type TransitTrackerDevice
} from "./transit-tracker-device"
import { ESPHomeRpcClient, JsonRpcError } from "$lib/esphome-rpc"
import type { SerialContext } from "$lib/serial-context"

const INVALID_PARAMS = -32602

export class UsbTransitTrackerDevice implements TransitTrackerDevice {
  private static instance: UsbTransitTrackerDevice | null = null

  static getInstance(ctx: SerialContext): UsbTransitTrackerDevice {
    if (!UsbTransitTrackerDevice.instance) {
      UsbTransitTrackerDevice.instance = new UsbTransitTrackerDevice(ctx)
    } else {
      UsbTransitTrackerDevice.instance.ctx = ctx
    }

    return UsbTransitTrackerDevice.instance
  }

  constructor(private ctx: SerialContext) {}

  private port: SerialPort | null = null
  private rpc: ESPHomeRpcClient | null = null

  async close() {
    if (this.rpc) {
      await this.rpc.disconnect()
      this.rpc = null
    }

    if (this.port) {
      try {
        await this.port.close()
      } catch (e: any) {
        console.warn("Error closing serial port:", e)
      }

      this.port = null
    }
  }

  async getProjectVersion(): Promise<string | null> {
    await this.initializeRpc()
    const { project_version } = await this.rpc!.getDeviceInfo()
    return project_version
  }

  async setTextEntity(id: string, value: string) {
    if (value.length > 255) {
      throw new ConfigValidationError(`Value for ${id} is too long: ${value.length} > 255`)
    }

    await this.initializeRpc()
    return this.call(id, () => this.rpc!.setTextEntity(id, value))
  }

  async setSelectEntity(id: string, value: string) {
    await this.initializeRpc()
    return this.call(id, () => this.rpc!.setSelectEntity(id, value))
  }

  async setSwitchEntity(id: string, value: "ON" | "OFF") {
    await this.initializeRpc()
    return this.call(id, () => this.rpc!.setSwitchEntity(id, value))
  }

  async pressButton(id: string) {
    await this.initializeRpc()
    return this.call(id, () => this.rpc!.pressButton(id))
  }

  // Firmware that lacks an entity answers with "Entity not found" (or
  // "Button not found"). Report it as a failed result instead of aborting
  // so the rest of the config still gets applied.
  private async call(id: string, fn: () => Promise<boolean>): Promise<SetEntityResult> {
    try {
      return { name: id, ok: await fn() }
    } catch (e) {
      if (e instanceof JsonRpcError && e.code === INVALID_PARAMS) {
        console.warn(`Device has no entity "${id}":`, e.message)
        return { name: id, ok: false }
      }
      throw e
    }
  }

  private async initializeRpc() {
    if (!this.port) {
      this.port = await this.ctx.getOpenSerialPort()
    }

    if (!this.rpc) {
      this.rpc = new ESPHomeRpcClient(this.port)
      await this.rpc.connect()
    }
  }
}
