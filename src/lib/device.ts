import { getWebSocketEndpoint, rowId, type ConfigState } from "./state"
import { ConfigValidationError, type TransitTrackerDevice } from "./device/transit-tracker-device"

/** The device's text settings hold at most 255 characters. */
export const MAX_SETTING_LENGTH = 255

/** The rows setting: "t;routeId,stopId[,offsetSeconds]" or "b;stationId" per line. */
export function rowsSetting(config: ConfigState) {
  return config.rows
    .map((row) => {
      if (row.kind === "bike") return `b;${row.stationId}`
      const travelMinutes = config.stopTimeOffsets[row.stopId] ?? 0
      const offset = travelMinutes ? `,${travelMinutes * -60}` : ""
      return `t;${row.routeId},${row.stopId}${offset}`
    })
    .join("\n")
}

/** The row names setting: "rowId;name" per line, for rows with a custom name. */
export function rowNamesSetting(config: ConfigState) {
  return config.rows
    .filter((row) => row.customName.trim() !== "")
    .map((row) => `${rowId(row)};${row.customName.trim()}`)
    .join("\n")
}

function validate(config: ConfigState) {
  const rows = rowsSetting(config)
  if (rows.length > MAX_SETTING_LENGTH) {
    throw new ConfigValidationError(
      "Too many rows to save on the device. Remove a few rows that are not shown, then try again."
    )
  }
  if (rowNamesSetting(config).length > MAX_SETTING_LENGTH) {
    throw new ConfigValidationError("The custom row names are too long in total. Shorten a few.")
  }
}

async function* configRequestGenerator(device: TransitTrackerDevice, config: ConfigState) {
  yield device.setTextEntity("base_url_config", getWebSocketEndpoint(config.apiBaseUrl))

  yield device.setTextEntity("feed_code_config", "")

  yield device.setTextEntity("row_names_config", rowNamesSetting(config))

  yield device.setTextEntity("rows_config", rowsSetting(config))

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
