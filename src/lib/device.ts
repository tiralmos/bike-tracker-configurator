import { getWebSocketEndpoint, type ConfigState } from "./state"
import type { TransitTrackerDevice } from "./device/transit-tracker-device"

async function* configRequestGenerator(device: TransitTrackerDevice, config: ConfigState) {
  yield device.setTextEntity("base_url_config", getWebSocketEndpoint(config.apiBaseUrl))

  yield device.setTextEntity("feed_code_config", "")

  yield device.setTextEntity(
    "stations_config",
    config.stations.map((station) => station.stationId).join(";")
  )

  yield device.setTextEntity(
    "station_names_config",
    config.stations
      .filter((station) => station.customName.trim() !== "")
      .map((station) => `${station.stationId};${station.customName.trim()}`)
      .join("\n")
  )

  yield device.setTextEntity("header_text_config", config.headerText)

  yield device.setTextEntity(
    "abbreviations_config",
    config.abbreviations
      .map((abbr) => {
        return `${abbr.from};${abbr.to}`
      })
      .join("\n")
  )

  yield device.setSwitchEntity(
    "scroll_station_names",
    config.nameOverflow === "scroll" ? "ON" : "OFF"
  )
}

export async function pushConfigToDevice(config: ConfigState, device: TransitTrackerDevice) {
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
