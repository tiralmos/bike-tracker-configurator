/** Keeps the station list within the device's 255-character text setting */
export const MAX_STATIONS = 10

/** How many station rows fit on the 128x32 display (one less with header text). */
export function rowsOnDisplay(headerText: string) {
  return headerText.trim() === "" ? 3 : 2
}
