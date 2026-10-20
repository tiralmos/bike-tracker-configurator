import semver from "semver"

// Served by the configurator itself: its Docker image downloads the
// latest firmware release of tiralmos/bike-tracker into /firmware.
export const FIRMWARE_BIN_URL = "/firmware/firmware.ota.bin"

export const FIRMWARE_FACTORY_BIN_URL = "/firmware/firmware.factory.bin"

const MANIFEST_URL = "/firmware/manifest.json"

// Release tags are typed by hand, so accept loose forms like "v1.0.1",
// "v.1.0.1" or "1.0" instead of throwing on anything that isn't strict semver.
export function parseVersion(version: string): semver.SemVer | null {
  return semver.coerce(version)
}

export function isUpdateAvailable(deviceVersion: string | null, latestVersion: string): boolean {
  if (deviceVersion === null) return true
  if (deviceVersion === "dev") return false

  const latest = parseVersion(latestVersion)
  if (latest === null) return false

  const current = parseVersion(deviceVersion)
  if (current === null) return true

  return semver.lt(current, latest)
}

export function releaseNotesUrl(version: string) {
  return `https://github.com/tiralmos/bike-tracker/releases/tag/${version}`
}

export async function getLatestFirmwareVersion(): Promise<string> {
  const resp = await fetch(MANIFEST_URL)
  if (!resp.ok) {
    throw new Error(`Failed to fetch firmware manifest: ${resp.status} ${resp.statusText}`)
  }

  const { version } = await resp.json()
  return version
}
