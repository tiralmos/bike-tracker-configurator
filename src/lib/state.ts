import { writable } from "svelte/store"
import { defaultBaseUrl } from "./config"
import type { FakeDeviceOptions } from "./device/fake-device"

/** A transit line at a stop: the row shows its next departure. */
export interface TransitRow {
  kind: "transit"
  routeId: string
  routeName: string
  /** Hex color without "#", from the feed */
  color: string | null
  headsigns: string[]
  stopId: string
  stopCode: string | null
  stopName: string
  /** Shown on the display instead of the trip's destination, if set */
  customName: string
}

/** A bike-share station: the row shows its free docks, bikes and e-bikes. */
export interface BikeRow {
  kind: "bike"
  stationId: string
  /** The station's name in the bike-share feed */
  name: string
  /** Shown on the display instead of the station's name, if set */
  customName: string
}

export type DisplayRow = TransitRow | BikeRow

/** A line at a stop, as picked on the transit map. */
export interface RouteAtStop {
  stopId: string
  stopCode: string | null
  stopName: string
  routeId: string
  routeName: string
  headsigns: string[]
  color: string | null
}

export interface RouteStyle {
  routeId: string
  name: string
  color: string
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

export interface Localization {
  now: string
  minLong: string
  minShort: string
  hoursShort: string
}

export interface ConfigState {
  apiBaseUrl: string
  /** Top to bottom, as on the display */
  rows: DisplayRow[]
  routeStyles: RouteStyle[]
  headerText: string
  abbreviations: Abbreviation[]
  /** Travel time to each stop in minutes, subtracted from its departure times */
  stopTimeOffsets: Record<string, number>
  timeDisplay: "arrival" | "departure"
  timeUnits: "long" | "short" | "none"
  displayOrientation: "normal" | "flipped"
  nameOverflow: "hidden" | "scroll"
  localization: Localization
}

/** Identifies a row on the device, e.g. in the row names setting. */
export function rowId(row: DisplayRow) {
  return row.kind === "transit" ? `${row.routeId},${row.stopId}` : row.stationId
}

export function rowKey(row: DisplayRow) {
  return `${row.kind}:${rowId(row)}`
}

export function isSameRouteAtStop(
  a: { routeId: string; stopId: string },
  b: { routeId: string; stopId: string }
) {
  return a.routeId === b.routeId && a.stopId === b.stopId
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

const CONFIG_KEY = "transitTrackerLyonConfig"
const BIKE_TRACKER_CONFIG_KEY = "bikeTrackerConfig"

const defaultConfig: ConfigState = {
  apiBaseUrl: defaultBaseUrl,
  rows: [],
  routeStyles: [],
  headerText: "",
  abbreviations: [],
  stopTimeOffsets: {},
  timeDisplay: "departure",
  timeUnits: "long",
  displayOrientation: "normal",
  nameOverflow: "scroll",
  localization: {
    now: "Now",
    minLong: "min",
    minShort: "m",
    hoursShort: "h"
  }
}

/**
 * The first time this configurator opens in a browser that used the
 * bike-only configurator, start from its settings, with its stations as
 * bike rows.
 */
function importBikeTrackerConfig() {
  try {
    if (localStorage.getItem(CONFIG_KEY) !== null) return
    const stored = localStorage.getItem(BIKE_TRACKER_CONFIG_KEY)
    if (stored === null) return

    const old = JSON.parse(stored)
    const imported: ConfigState = {
      ...defaultConfig,
      apiBaseUrl: old.apiBaseUrl ?? defaultConfig.apiBaseUrl,
      headerText: old.headerText ?? "",
      abbreviations: old.abbreviations ?? [],
      displayOrientation: old.displayOrientation ?? "normal",
      nameOverflow: old.nameOverflow ?? "scroll",
      rows: (old.stations ?? []).map(
        (station: { stationId: string; name: string; customName?: string }): BikeRow => ({
          kind: "bike",
          stationId: station.stationId,
          name: station.name,
          customName: station.customName ?? ""
        })
      )
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(imported))
  } catch (error) {
    console.error("Could not import the Transit Tracker configuration:", error)
  }
}

importBikeTrackerConfig()

export const config = createPersistentStore<ConfigState>(
  CONFIG_KEY,
  defaultConfig,
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
