import { writable } from "svelte/store"
import { defaultBaseUrl } from "./config"
import type { FakeDeviceOptions } from "./device/fake-device"

export interface SelectedStation {
  stationId: string
  /** The station's name in the bike-share feed */
  name: string
  /** Shown on the display instead of the station's name, if set */
  customName: string
}

export interface Feed {
  code: string
  name: string
  description: string
  bounds: [number, number, number, number]
}

export interface Abbreviation {
  from: string
  to: string
}

export interface ConfigState {
  apiBaseUrl: string
  stations: SelectedStation[]
  headerText: string
  abbreviations: Abbreviation[]
  displayOrientation: "normal" | "flipped"
  nameOverflow: "hidden" | "scroll"
}

function migrateBaseUrlToHttp(config: ConfigState): ConfigState {
  if (config.apiBaseUrl.startsWith("ws://") || config.apiBaseUrl.startsWith("wss://")) {
    const url = new URL(config.apiBaseUrl)
    url.protocol = url.protocol === "ws:" ? "http:" : "https:"
    url.pathname = ""
    config.apiBaseUrl = url.href
  }

  return config
}

function createPersistentStore<T>(key: string, initialValue: T, ...migrate: ((value: T) => T)[]) {
  let currentValue: T = initialValue

  // Attempt to retrieve existing value from localStorage
  try {
    const storedValue = localStorage.getItem(key)
    if (storedValue !== null) {
      currentValue = JSON.parse(storedValue) as T
      for (const key in initialValue) {
        if (currentValue[key] === undefined) {
          currentValue[key] = initialValue[key]
        }
      }
    }
  } catch (error) {
    console.error(`Error parsing JSON from localStorage key "${key}":`, error)
  }

  currentValue = migrate.reduce((value, migrateFn) => migrateFn(value), currentValue)

  // Create a Svelte writable store with the (possibly) retrieved value
  const store = writable<T>(currentValue)

  // Subscribe to changes so every update is also reflected in localStorage
  store.subscribe((value) => {
    localStorage.setItem(key, JSON.stringify(value))
  })

  return store
}

export function getWebSocketEndpoint(baseUrl: string) {
  const url = new URL(baseUrl)
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:"
  url.pathname = "/"
  return url.href
}

export const config = createPersistentStore<ConfigState>(
  "bikeTrackerConfig",
  {
    apiBaseUrl: defaultBaseUrl,
    stations: [],
    headerText: "",
    abbreviations: [],
    displayOrientation: "normal",
    nameOverflow: "scroll"
  },
  migrateBaseUrlToHttp
)

/** The API runs on this computer, so the display (on the network) cannot reach it at this address. */
export function isLoopbackUrl(baseUrl: string) {
  const { hostname } = new URL(baseUrl)
  return hostname === "localhost" || hostname === "[::1]" || hostname.startsWith("127.")
}

export interface DeviceConnection {
  type: "network" | "usb" | "none" | "fake"
  baseUrl?: string
  fakeOptions?: FakeDeviceOptions
}

export const deviceConnection = createPersistentStore<DeviceConnection>("deviceConnection", {
  type: "none"
})
