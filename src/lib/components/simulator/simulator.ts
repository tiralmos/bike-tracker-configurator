import { FONT_BITMAP, type Glyph, GLYPH_TABLE } from "./font"

export interface Station {
  stationId: string
  name: string
  docksAvailable: number
  mechanicalBikesAvailable: number
  electricBikesAvailable: number
  isRenting: boolean
  isReturning: boolean
}

export interface Trip {
  routeName: string
  routeColor: Color
  headsign: string
  arrivalTime: number
  departureTime: number
  isRealtime: boolean
}

/** One row on the display, drawn like the firmware draws it. */
export type SimulatorRow =
  | {
      kind: "transit"
      /** Shown when there is no upcoming trip */
      routeName: string
      routeColor: Color
      /** Replaces the trip's destination, if set */
      customName?: string
      trip: Trip | null
    }
  | {
      kind: "bike"
      /** Station name, or the row's custom name */
      name: string
      station: Station | null
    }

export type UnitDisplay = "long" | "short" | "none"

export interface TimeStrings {
  now: string
  minLong: string
  minShort: string
  hoursShort: string
}

export interface Color {
  r: number
  g: number
  b: number
}

export interface SimulatorOptions {
  width?: number
  height?: number
  pixelPitch?: number
  glowRadius?: number
  glowAlpha?: number
  brightness?: number
  limit?: number
  headerText?: string
  scrollNames?: boolean
  unitDisplay?: UnitDisplay
  displayDepartureTimes?: boolean
  timeStrings?: TimeStrings
  realtimeColor?: Color
}

function colorToCSS(c: Color): string {
  return `rgb(${c.r},${c.g},${c.b})`
}

function colorToGlowCSS(c: Color, alpha: number): string {
  return `rgba(${c.r},${c.g},${c.b},${alpha})`
}

export function hexColor(hex: number): Color {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff
  }
}

const GLYPH_MAP = new Map<number, Glyph>()
for (const g of GLYPH_TABLE) {
  GLYPH_MAP.set(g.codePoint, g)
}

const FONT_BASELINE = 8
const FONT_DESCENDER = 2

class BitmapFont {
  getAscender(): number {
    return FONT_BASELINE
  }
  getDescender(): number {
    return FONT_DESCENDER
  }

  getGlyph(codePoint: number): Glyph | undefined {
    return GLYPH_MAP.get(codePoint)
  }

  measureText(text: string): number {
    let x = 0
    for (let i = 0; i < text.length; i++) {
      const glyph = this.getGlyph(text.charCodeAt(i))
      if (glyph) x += glyph.advance
    }
    return x
  }

  drawText(fb: PixelFramebuffer, x: number, y: number, text: string, color: Color) {
    let cursorX = x
    for (let i = 0; i < text.length; i++) {
      const glyph = this.getGlyph(text.charCodeAt(i))
      if (!glyph) continue
      this.drawGlyph(fb, cursorX + glyph.offsetX, y + glyph.offsetY, glyph, color)
      cursorX += glyph.advance
    }
  }

  private drawGlyph(fb: PixelFramebuffer, x: number, y: number, glyph: Glyph, color: Color) {
    let byteIndex = glyph.dataOffset
    let bitmask = 0
    let pixelData = 0

    for (let gy = 0; gy < glyph.height; gy++) {
      for (let gx = 0; gx < glyph.width; gx++) {
        if (bitmask === 0) {
          pixelData = FONT_BITMAP[byteIndex++]
          bitmask = 0x80
        }
        if ((pixelData & bitmask) !== 0) {
          fb.drawPixel(x + gx, y + gy, color)
        }
        bitmask >>= 1
      }
    }
  }
}

interface ClipRect {
  x1: number
  y1: number
  x2: number
  y2: number
}

class PixelFramebuffer {
  readonly width: number
  readonly height: number
  readonly data: Uint8Array // RGBA format

  private clip: ClipRect | null = null

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.data = new Uint8Array(width * height * 4)
  }

  clear() {
    this.data.fill(0)
  }

  startClipping(x1: number, y1: number, x2: number, y2: number) {
    this.clip = { x1, y1, x2, y2 }
  }

  endClipping() {
    this.clip = null
  }

  drawPixel(x: number, y: number, color: Color) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return
    if (this.clip) {
      if (x < this.clip.x1 || x >= this.clip.x2 || y < this.clip.y1 || y >= this.clip.y2) return
    }
    const idx = (y * this.width + x) * 4
    this.data[idx] = color.r
    this.data[idx + 1] = color.g
    this.data[idx + 2] = color.b
    this.data[idx + 3] = 255
  }
}

const SCROLL_SPEED = 10 // pixels/second
const IDLE_TIME_LEFT = 5000 // ms
const IDLE_TIME_RIGHT = 1000 // ms

class CanvasRenderer {
  private ctx: CanvasRenderingContext2D

  private dpr: number

  constructor(
    private canvas: HTMLCanvasElement,
    private displayWidth: number,
    private displayHeight: number,
    private pitch: number,
    private glowRadius: number,
    private glowAlpha: number,
    private brightness: number = 1
  ) {
    this.dpr = window.devicePixelRatio || 1
    this.setCanvasSize()
    this.ctx = canvas.getContext("2d")!
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  private setCanvasSize() {
    this.canvas.width = this.displayWidth * this.pitch * this.dpr
    this.canvas.height = this.displayHeight * this.pitch * this.dpr
  }

  render(fb: PixelFramebuffer) {
    const ctx = this.ctx
    const pitch = this.pitch
    const pixelRadius = pitch * 0.35

    ctx.fillStyle = "#0a0a0a"
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Draw unlit pixel grid (subtle dots)
    ctx.fillStyle = "rgba(30,30,30,0.5)"
    for (let y = 0; y < this.displayHeight; y++) {
      for (let x = 0; x < this.displayWidth; x++) {
        const cx = x * pitch + pitch / 2
        const cy = y * pitch + pitch / 2
        ctx.beginPath()
        ctx.arc(cx, cy, pixelRadius * 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Draw lit pixels with glow
    ctx.save()
    for (let y = 0; y < this.displayHeight; y++) {
      for (let x = 0; x < this.displayWidth; x++) {
        const idx = (y * fb.width + x) * 4
        const a = fb.data[idx + 3]
        if (a === 0) continue

        const r = Math.min(255, Math.round(fb.data[idx] * this.brightness))
        const g = Math.min(255, Math.round(fb.data[idx + 1] * this.brightness))
        const b = Math.min(255, Math.round(fb.data[idx + 2] * this.brightness))

        const cx = x * pitch + pitch / 2
        const cy = y * pitch + pitch / 2

        if (this.glowRadius > 0) {
          ctx.shadowBlur = this.glowRadius
          ctx.shadowColor = colorToGlowCSS({ r, g, b }, this.glowAlpha)
        } else {
          ctx.shadowBlur = 0
        }

        ctx.fillStyle = colorToCSS({ r, g, b })
        ctx.beginPath()
        ctx.arc(cx, cy, pixelRadius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  resize(displayWidth: number, displayHeight: number) {
    this.displayWidth = displayWidth
    this.displayHeight = displayHeight
    this.setCanvasSize()
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  setPitch(pitch: number) {
    this.pitch = pitch
    this.setCanvasSize()
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  setGlow(radius: number, alpha: number) {
    this.glowRadius = radius
    this.glowAlpha = alpha
  }

  setBrightness(brightness: number) {
    this.brightness = brightness
  }
}

// Keep in sync with the icons in the ESPHome component (bike_tracker.cpp).
// '#' uses the icon's color, '+' the accent (bolt) color.
const DOCK_ICON = [".#####.", "##...##", "##.#.##", "##...##", "##.####", "##.####", ".#####."]

const BIKE_ICON = [
  "..##...##..",
  "...#...#...",
  "...#####...",
  ".##.#.#.##.",
  "#..#.#.#..#",
  "#..#...#..#",
  ".##.....##."
]

const EBIKE_ICON = [
  "..+..##...##..",
  ".+....#...#...",
  "+++...#####...",
  ".+..##.#.#.##.",
  "+..#..#.#.#..#",
  "...#..#...#..#",
  "....##.....##."
]

/** The Vélo'v logo, on the left of each bike row like a transit row's line badge (same as the firmware) */
const BIKE_BADGE_ICON = [
  ".....##.",
  "....###.",
  "##..####",
  "###.##..",
  ".##.##..",
  ".#####..",
  ".####...",
  "..###..."
]
const BIKE_BADGE_COLOR = hexColor(0xe4022e)

const ICON_COUNT_GAP = 1
const GROUP_GAP = 3

const DOCKS_COLOR = hexColor(0x00a8ff)
const MECHANICAL_COLOR = hexColor(0xe2001a)
const ELECTRIC_COLOR = hexColor(0x2ecc40)
const BOLT_COLOR = hexColor(0xffd200)
const COUNT_COLOR = hexColor(0xffffff)
const UNAVAILABLE_COLOR = hexColor(0x404040)
const HEADER_COLOR = hexColor(0x00bdbd)

function drawIcon(
  fb: PixelFramebuffer,
  rows: string[],
  leftX: number,
  bottomY: number,
  color: Color,
  accentColor: Color
) {
  rows.forEach((row, rowIndex) => {
    const y = bottomY - (rows.length - 1 - rowIndex)
    for (let col = 0; col < row.length; col++) {
      if (row[col] === "#") fb.drawPixel(leftX + col, y, color)
      else if (row[col] === "+") fb.drawPixel(leftX + col, y, accentColor)
    }
  })
}

const DEFAULT_TIME_STRINGS: TimeStrings = {
  now: "Now",
  minLong: "min",
  minShort: "m",
  hoursShort: "h"
}

/** Same output as the firmware's Localization::fmt_duration_from_now */
export function formatDurationFromNow(
  unixTimestamp: number,
  rtcNow: number,
  unitDisplay: UnitDisplay,
  strings: TimeStrings = DEFAULT_TIME_STRINGS
): string {
  const diff = unixTimestamp - rtcNow
  if (diff < 30) return strings.now

  const minutes = diff < 60 ? 0 : Math.floor(diff / 60)
  if (minutes < 60) {
    switch (unitDisplay) {
      case "long":
        return `${minutes}${strings.minLong}`
      case "short":
        return `${minutes}${strings.minShort}`
      default:
        return `${minutes}`
    }
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (unitDisplay === "none") return `${hours}:${String(remainingMinutes).padStart(2, "0")}`
  return `${hours}${strings.hoursShort}${remainingMinutes}${strings.minShort}`
}

const REALTIME_ICON: number[][] = [
  [0, 0, 0, 3, 3, 3],
  [0, 0, 3, 0, 0, 0],
  [0, 3, 0, 0, 2, 2],
  [3, 0, 0, 2, 0, 0],
  [3, 0, 2, 0, 0, 1],
  [3, 0, 2, 0, 1, 1]
]

function drawRealtimeIcon(
  fb: PixelFramebuffer,
  bottomRightX: number,
  bottomRightY: number,
  uptime: number,
  realtimeColor: Color,
  realtimeColorDark: Color
) {
  const numFrames = 6
  const idleFrameDuration = 3000
  const animFrameDuration = 200
  const cycleDuration = idleFrameDuration + (numFrames - 1) * animFrameDuration

  const cycleTime = uptime % cycleDuration
  const frame =
    cycleTime < idleFrameDuration
      ? 0
      : 1 + Math.floor((cycleTime - idleFrameDuration) / animFrameDuration)

  const isSegmentLit = (segment: number): boolean => {
    switch (segment) {
      case 1:
        return frame >= 1 && frame <= 3
      case 2:
        return frame >= 2 && frame <= 4
      case 3:
        return frame >= 3 && frame <= 5
      default:
        return false
    }
  }

  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const segment = REALTIME_ICON[i][j]
      if (segment === 0) continue
      const color = isSegmentLit(segment) ? realtimeColor : realtimeColorDark
      fb.drawPixel(bottomRightX - (5 - j), bottomRightY - (5 - i), color)
    }
  }
}

function scrollOffsetAt(overflow: number, uptime: number, scrollCycleDuration: number) {
  if (overflow <= 0 || scrollCycleDuration <= 0) return 0

  const scrollTime = Math.floor((overflow * 1000) / SCROLL_SPEED)
  const t = uptime % scrollCycleDuration

  if (t < IDLE_TIME_LEFT) return 0
  if (t < IDLE_TIME_LEFT + scrollTime) {
    return Math.floor(((t - IDLE_TIME_LEFT) * SCROLL_SPEED) / 1000)
  }
  if (t < IDLE_TIME_LEFT + scrollTime + IDLE_TIME_RIGHT) return overflow
  if (t < IDLE_TIME_LEFT + 2 * scrollTime + IDLE_TIME_RIGHT) {
    const sinceStart = t - (IDLE_TIME_LEFT + scrollTime + IDLE_TIME_RIGHT)
    return overflow - Math.floor((sinceStart * SCROLL_SPEED) / 1000)
  }
  return 0
}

const WHITE = hexColor(0xffffff)
const SCHEDULED_TIME_COLOR = hexColor(0xa7a7a7)

/** Draws transit and bike-share rows the same way the firmware does. */
export class TrackerSimulator {
  private fb: PixelFramebuffer
  private renderer: CanvasRenderer
  private font = new BitmapFont()
  private rows: SimulatorRow[] = []
  private animationId: number | null = null
  private startTime = 0

  private width: number
  private height: number
  private limit: number
  private headerText: string
  private scrollNames: boolean
  private unitDisplay: UnitDisplay
  private displayDepartureTimes: boolean
  private timeStrings: TimeStrings
  private realtimeColor: Color
  private realtimeColorDark: Color

  constructor(canvas: HTMLCanvasElement, options: SimulatorOptions = {}) {
    this.width = options.width ?? 128
    this.height = options.height ?? 32
    this.limit = options.limit ?? 3
    this.headerText = options.headerText ?? ""
    this.scrollNames = options.scrollNames ?? true
    this.unitDisplay = options.unitDisplay ?? "long"
    this.displayDepartureTimes = options.displayDepartureTimes ?? true
    this.timeStrings = options.timeStrings ?? DEFAULT_TIME_STRINGS
    this.realtimeColor = options.realtimeColor ?? { r: 0x20, g: 0xff, b: 0x00 }
    this.realtimeColorDark = {
      r: Math.floor(this.realtimeColor.r * 0.5),
      g: Math.floor(this.realtimeColor.g * 0.5),
      b: Math.floor(this.realtimeColor.b * 0.5)
    }

    this.fb = new PixelFramebuffer(this.width, this.height)
    this.renderer = new CanvasRenderer(
      canvas,
      this.width,
      this.height,
      options.pixelPitch ?? 4,
      options.glowRadius ?? 4,
      options.glowAlpha ?? 0.6,
      options.brightness ?? 1
    )
  }

  setRows(rows: SimulatorRow[]) {
    this.rows = rows
  }

  start() {
    if (this.animationId !== null) return
    this.startTime = performance.now()
    const loop = () => {
      this.drawFrame()
      this.animationId = requestAnimationFrame(loop)
    }
    this.animationId = requestAnimationFrame(loop)
  }

  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  private drawCentered(msg: string) {
    const textWidth = this.font.measureText(msg)
    const x = Math.floor((this.width - textWidth) / 2)
    const y = Math.floor((this.height - (this.font.getAscender() + this.font.getDescender())) / 2)
    this.font.drawText(this.fb, x, y, msg, { r: 150, g: 150, b: 150 })
  }

  private drawFrame() {
    this.fb.clear()

    if (this.rows.length === 0) {
      this.drawCentered("No rows configured")
      this.renderer.render(this.fb)
      return
    }

    const uptime = performance.now() - this.startTime
    const rtcNow = Math.floor(Date.now() / 1000)
    const fontAscender = this.font.getAscender()
    const fontDescender = this.font.getDescender()
    const nominalFontHeight = fontAscender + fontDescender
    // The header text takes the place of one row
    const rows = this.rows.slice(0, this.headerText ? this.limit - 1 : this.limit)

    // Every name scrolls in step, so the cycle lasts as long as the longest one needs
    let scrollCycleDuration = 0
    if (this.scrollNames) {
      let largestOverflow = 0
      for (const row of rows) {
        largestOverflow = Math.max(largestOverflow, this.drawRow(row, 0, uptime, rtcNow, 0, false))
      }
      if (largestOverflow > 0) {
        const longestScrollTime = Math.floor((largestOverflow * 1000) / SCROLL_SPEED)
        scrollCycleDuration = IDLE_TIME_LEFT + IDLE_TIME_RIGHT + 2 * longestScrollTime
      }
    }

    // Vertical centering (matching C++ logic)
    const maxRowsHeight = this.limit * fontAscender + (this.limit - 1) * fontDescender
    let yOffset = Math.floor((this.height % maxRowsHeight) / 2)

    if (this.headerText) {
      this.font.drawText(this.fb, 0, yOffset, this.headerText, HEADER_COLOR)
      yOffset += nominalFontHeight
    }

    for (const row of rows) {
      this.drawRow(row, yOffset, uptime, rtcNow, scrollCycleDuration, true)
      yOffset += nominalFontHeight
    }

    this.renderer.render(this.fb)
  }

  /** Returns how many pixels the row's name is too wide for. */
  private drawRow(
    row: SimulatorRow,
    yOffset: number,
    uptime: number,
    rtcNow: number,
    scrollCycleDuration: number,
    draw: boolean
  ): number {
    return row.kind === "transit"
      ? this.drawTransitRow(row, yOffset, uptime, rtcNow, scrollCycleDuration, draw)
      : this.drawBikeRow(row, yOffset, uptime, scrollCycleDuration, draw)
  }

  private drawTransitRow(
    row: Extract<SimulatorRow, { kind: "transit" }>,
    yOffset: number,
    uptime: number,
    rtcNow: number,
    scrollCycleDuration: number,
    draw: boolean
  ): number {
    const fontHeight = this.font.getAscender() + this.font.getDescender()
    const trip = row.trip
    const routeName = trip?.routeName ?? row.routeName
    const routeColor = trip?.routeColor ?? row.routeColor

    const routeWidth = this.font.measureText(routeName)
    if (draw) this.font.drawText(this.fb, 0, yOffset, routeName, routeColor)

    const timeText = trip
      ? formatDurationFromNow(
          this.displayDepartureTimes ? trip.departureTime : trip.arrivalTime,
          rtcNow,
          this.unitDisplay,
          this.timeStrings
        )
      : "--"
    const timeWidth = this.font.measureText(timeText)
    const isRealtime = trip?.isRealtime ?? false
    if (draw) {
      const timeColor = isRealtime ? this.realtimeColor : SCHEDULED_TIME_COLOR
      this.font.drawText(this.fb, this.width + 1 - timeWidth, yOffset, timeText, timeColor)
    }

    const clipStart = routeWidth + 3
    let clipEnd = this.width - timeWidth - 2
    if (isRealtime) {
      clipEnd -= 8
      if (draw) {
        drawRealtimeIcon(
          this.fb,
          this.width - timeWidth - 2,
          yOffset + fontHeight - 6,
          uptime,
          this.realtimeColor,
          this.realtimeColorDark
        )
      }
    }

    const name = row.customName || trip?.headsign || "No departures"
    const nameColor = row.customName || trip ? WHITE : UNAVAILABLE_COLOR
    const overflow = this.font.measureText(name) - (clipEnd - clipStart)

    if (draw) {
      const scrollOffset = scrollOffsetAt(overflow, uptime, scrollCycleDuration)
      this.fb.startClipping(clipStart, 0, clipEnd, this.height)
      this.font.drawText(this.fb, clipStart - scrollOffset, yOffset, name, nameColor)
      this.fb.endClipping()
    }
    return overflow
  }

  private drawBikeRow(
    row: Extract<SimulatorRow, { kind: "bike" }>,
    yOffset: number,
    uptime: number,
    scrollCycleDuration: number,
    draw: boolean
  ): number {
    const station = row.station
    const isRenting = station?.isRenting ?? false
    const isReturning = station?.isReturning ?? false

    const groups = [
      {
        icon: EBIKE_ICON,
        count: station?.electricBikesAvailable ?? 0,
        color: ELECTRIC_COLOR,
        available: isRenting
      },
      {
        icon: BIKE_ICON,
        count: station?.mechanicalBikesAvailable ?? 0,
        color: MECHANICAL_COLOR,
        available: isRenting
      },
      {
        icon: DOCK_ICON,
        count: station?.docksAvailable ?? 0,
        color: DOCKS_COLOR,
        available: isReturning
      }
    ]

    const countWidth = this.font.measureText("00")
    const iconBottomY = yOffset + this.font.getAscender() - 1

    let x = this.width
    for (const group of groups) {
      x -= countWidth
      if (draw) {
        const countColor = group.available && group.count > 0 ? COUNT_COLOR : UNAVAILABLE_COLOR
        this.font.drawText(this.fb, x, yOffset, station ? String(group.count) : "-", countColor)
      }

      x -= ICON_COUNT_GAP + group.icon[0].length
      if (draw) {
        drawIcon(
          this.fb,
          group.icon,
          x,
          iconBottomY,
          group.available ? group.color : UNAVAILABLE_COLOR,
          group.available ? BOLT_COLOR : UNAVAILABLE_COLOR
        )
      }
      x -= GROUP_GAP
    }

    const isOpen = isRenting || isReturning
    if (draw) {
      drawIcon(
        this.fb,
        BIKE_BADGE_ICON,
        0,
        iconBottomY,
        isOpen ? BIKE_BADGE_COLOR : UNAVAILABLE_COLOR,
        COUNT_COLOR
      )
    }
    const nameStart = BIKE_BADGE_ICON[0].length + 3

    const name = row.name || "Station not found"
    const overflow = this.font.measureText(name) - (x - nameStart)

    if (draw) {
      const scrollOffset = scrollOffsetAt(overflow, uptime, scrollCycleDuration)
      const nameColor = isOpen ? COUNT_COLOR : UNAVAILABLE_COLOR
      this.fb.startClipping(nameStart, 0, x, this.height)
      this.font.drawText(this.fb, nameStart - scrollOffset, yOffset, name, nameColor)
      this.fb.endClipping()
    }
    return overflow
  }
}
