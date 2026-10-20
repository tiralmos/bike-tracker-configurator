/** Limit of the API's station subscription */
export const MAX_STATIONS = 25

/** How many station rows fit on the 128x32 display (one less with header text). */
export function rowsOnDisplay(headerText: string) {
  return headerText.trim() === "" ? 3 : 2
}
