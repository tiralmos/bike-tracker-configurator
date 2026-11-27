import {
  allRows,
  getWebSocketEndpoint,
  parseClockTime,
  rowId,
  slotLabel,
  slotProblem,
  type ConfigState,
  type DisplayRow
} from "./state"
import { api } from "./api"
import { ConfigValidationError, type TransitTrackerDevice } from "./device/transit-tracker-device"

/** The device's text settings hold at most 255 characters. */
export const MAX_SETTING_LENGTH = 255

/** The rows continue over these settings, in order. */
export const ROWS_SETTINGS = ["rows_config", "rows_config_2", "rows_config_3", "rows_config_4"]
export const ROW_NAMES_SETTINGS = ["row_names_config", "row_names_config_2"]

function rowLine(config: ConfigState, row: DisplayRow) {
  if (row.kind === "bike") return `b;${row.stationId}`
  const travelMinutes = config.stopTimeOffsets[row.stopId] ?? 0
  const offset = travelMinutes ? `,${travelMinutes * -60}` : ""
  return `t;${row.routeId},${row.stopId}${offset}`
}

/** "07:30" to "0730" */
function compactTime(value: string) {
  const minutes = parseClockTime(value) ?? 0
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}${String(minutes % 60).padStart(2, "0")}`
}

/**
 * The rows text: "t;routeId,stopId[,offsetSeconds]" or "b;stationId" per
 * line, the default rows first, then "s;HHMM-HHMM" before each time slot's.
 */
export function rowsSetting(config: ConfigState) {
  const lines = config.rows.map((row) => rowLine(config, row))
  for (const slot of config.timeSlots) {
    lines.push(`s;${compactTime(slot.start)}-${compactTime(slot.end)}`)
    lines.push(...slot.rows.map((row) => rowLine(config, row)))
  }
  return lines.join("\n")
}

/** The row names text: "rowId;name" per line, for rows with a custom name. */
export function rowNamesSetting(config: ConfigState) {
  const names = new Map<string, string>()
  for (const row of allRows(config)) {
    const name = row.customName.trim()
    if (name && !names.has(rowId(row))) names.set(rowId(row), name)
  }
  return [...names].map(([id, name]) => `${id};${name}`).join("\n")
}

/**
 * Splits text over several settings at line breaks, or returns null if it
 * doesn't fit.
 */
export function splitSetting(text: string, count: number): string[] | null {
  const parts: string[] = []
  let current = ""
  for (const line of text === "" ? [] : text.split("\n")) {
    if (line.length > MAX_SETTING_LENGTH) return null
    const next = current === "" ? line : `${current}\n${line}`
    if (next.length > MAX_SETTING_LENGTH) {
      parts.push(current)
      current = line
    } else {
      current = next
    }
  }
  if (current !== "") parts.push(current)
  if (parts.length > count) return null
  while (parts.length < count) parts.push("")
  return parts
}

/** How full the rows settings are, from 0 to 1 */
export function rowsStorageUsed(config: ConfigState) {
  return rowsSetting(config).length / (MAX_SETTING_LENGTH * ROWS_SETTINGS.length)
}

function validate(config: ConfigState) {
  for (const slot of config.timeSlots) {
    const problem = slotProblem(slot, config.timeSlots)
    if (problem) {
      throw new ConfigValidationError(`Time slot ${slotLabel(slot)}: ${problem}`)
    }
  }
  if (!splitSetting(rowsSetting(config), ROWS_SETTINGS.length)) {
    throw new ConfigValidationError(
      "Too many rows to save on the device. Remove a few rows that are not shown, then try again."
    )
  }
  if (!splitSetting(rowNamesSetting(config), ROW_NAMES_SETTINGS.length)) {
    throw new ConfigValidationError("The custom row names are too long in total. Shorten a few.")
  }
}

/** Lyon city center, when no Vélo'v station gives a better place */
export const DEFAULT_WEATHER_LOCATION = { lat: 45.7578, lon: 4.832 }

/** The weather comes from the first Vélo'v row's station, else Lyon. */
export async function weatherLocation(config: ConfigState) {
  const firstBike = allRows(config).find((row) => row.kind === "bike")
  if (firstBike?.kind === "bike") {
    try {
      const station = (await api.listStations()).find((s) => s.stationId === firstBike.stationId)
      if (station) return { lat: station.lat, lon: station.lon }
    } catch (error) {
      console.error("Could not look up the station for the weather:", error)
    }
  }
  return DEFAULT_WEATHER_LOCATION
}

async function* configRequestGenerator(device: TransitTrackerDevice, config: ConfigState) {
  yield device.setTextEntity("base_url_config", getWebSocketEndpoint(config.apiBaseUrl))

  yield device.setTextEntity("feed_code_config", "")

  const names = splitSetting(rowNamesSetting(config), ROW_NAMES_SETTINGS.length)!
  for (const [index, setting] of ROW_NAMES_SETTINGS.entries()) {
    yield device.setTextEntity(setting, names[index])
  }

  // The continuation settings first, so the display applies all rows at once
  // when rows_config changes last
  const rows = splitSetting(rowsSetting(config), ROWS_SETTINGS.length)!
  for (const [index, setting] of [...ROWS_SETTINGS.entries()].reverse()) {
    yield device.setTextEntity(setting, rows[index])
  }

  if (config.brightness !== null) {
    yield device.setSelectEntity("brightness_config", `${config.brightness}%`)
  }

  yield device.setTextEntity("header_text_config", config.headerText)

  yield device.setTextEntity(
    "abbreviations_config",
    config.abbreviations
      .map((abbr) => {
        return `${abbr.from};${abbr.to}`
      })
      .join("\n")
  )

  yield device.setTextEntity(
    "route_styles_config",
    config.routeStyles
      .map((style) => {
        return `${style.routeId};${style.name};${style.color.replaceAll("#", "")}`
      })
      .join("\n")
  )

  yield device.setSelectEntity("time_display_config", config.timeDisplay)
  yield device.setSelectEntity("time_units_config", config.timeUnits)

  yield device.setSwitchEntity("scroll_names", config.nameOverflow === "scroll" ? "ON" : "OFF")

  const location = await weatherLocation(config)
  yield device.setTextEntity(
    "weather_location_config",
    `${location.lat.toFixed(4)},${location.lon.toFixed(4)}`
  )
  yield device.setSelectEntity("alerts_config", config.alerts ? "on" : "off")
  yield device.setSelectEntity("logo_color_config", config.logoColor)
  yield device.setSelectEntity("weather_config", config.weather ? "on" : "off")

  yield device.setTextEntity("now_str_config", config.localization.now)
  yield device.setTextEntity("min_long_str_config", config.localization.minLong)
  yield device.setTextEntity("min_short_str_config", config.localization.minShort)
  yield device.setTextEntity("hours_short_str_config", config.localization.hoursShort)
}

export async function pushConfigToDevice(config: ConfigState, device: TransitTrackerDevice) {
  validate(config)

  const results = []

  const deviceVersion = await device.getProjectVersion()

  const configRequests = configRequestGenerator(device, config)
  for await (const result of configRequests) {
    results.push(result)
  }

  await device.pressButton("write_preferences")
  await device.pressButton("reload_tracker")

  await device.close?.()

  return { results, deviceVersion }
}
