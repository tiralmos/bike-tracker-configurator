/**
 * Keeps the rows within the device's 255-character text settings
 * (a transit row takes about 25 characters).
 */
export const MAX_ROWS = 10

/** How many rows fit on the 128x32 display (one less with header text). */
export function rowsOnDisplay(headerText: string) {
  return headerText.trim() === "" ? 3 : 2
}
