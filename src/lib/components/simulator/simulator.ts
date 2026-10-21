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
  scrollStationNames?: boolean
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

export class BikeTrackerSimulator {
  private fb: PixelFramebuffer
  private renderer: CanvasRenderer
  private font = new BitmapFont()
  private stations: Station[] = []
  private animationId: number | null = null
  private startTime = 0

  private width: number
  private height: number
  private limit: number
  private headerText: string
  private scrollStationNames: boolean

  constructor(canvas: HTMLCanvasElement, options: SimulatorOptions = {}) {
    this.width = options.width ?? 128
    this.height = options.height ?? 32
    this.limit = options.limit ?? 3
    this.headerText = options.headerText ?? ""
    this.scrollStationNames = options.scrollStationNames ?? true

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

  setStations(stations: Station[]) {
    this.stations = stations
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

  private drawFrame() {
    this.fb.clear()

    if (this.stations.length === 0) {
      const msg = "No stations selected"
      const color = { r: 150, g: 150, b: 150 }
      const textWidth = this.font.measureText(msg)
      const x = Math.floor((this.width - textWidth) / 2)
      const y = Math.floor((this.height - (this.font.getAscender() + this.font.getDescender())) / 2)
      this.font.drawText(this.fb, x, y, msg, color)
      this.renderer.render(this.fb)
      return
    }

    const uptime = performance.now() - this.startTime
    const fontAscender = this.font.getAscender()
    const fontDescender = this.font.getDescender()
    const nominalFontHeight = fontAscender + fontDescender
    // The header text takes the place of one station row
    const stations = this.stations.slice(0, this.headerText ? this.limit - 1 : this.limit)

    // Two-pass name overflow measurement for synchronized scrolling
    let scrollCycleDuration = 0
    if (this.scrollStationNames) {
      let largestOverflow = 0
      for (const station of stations) {
        const overflow = this.font.measureText(station.name) - this.drawCounts(station, 0, false)
        largestOverflow = Math.max(largestOverflow, overflow)
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

    for (const station of stations) {
      this.drawStation(station, yOffset, uptime, scrollCycleDuration)
      yOffset += nominalFontHeight
    }

    this.renderer.render(this.fb)
  }

  /** Draws the icon and count groups and returns where the station name must end. */
  private drawCounts(station: Station, yOffset: number, draw: boolean): number {
    const groups = [
      {
        icon: EBIKE_ICON,
        count: station.electricBikesAvailable,
        color: ELECTRIC_COLOR,
        available: station.isRenting
      },
      {
        icon: BIKE_ICON,
        count: station.mechanicalBikesAvailable,
        color: MECHANICAL_COLOR,
        available: station.isRenting
      },
      {
        icon: DOCK_ICON,
        count: station.docksAvailable,
        color: DOCKS_COLOR,
        available: station.isReturning
      }
    ]

    const countWidth = this.font.measureText("00")
    const iconBottomY = yOffset + this.font.getAscender() - 1

    let x = this.width
    for (const group of groups) {
      x -= countWidth
      if (draw) {
        const countColor = group.available && group.count > 0 ? COUNT_COLOR : UNAVAILABLE_COLOR
        this.font.drawText(this.fb, x, yOffset, String(group.count), countColor)
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

    return x
  }

  private drawStation(
    station: Station,
    yOffset: number,
    uptime: number,
    scrollCycleDuration: number
  ) {
    const nameClippingEnd = this.drawCounts(station, yOffset, true)
    const nameOverflow = this.font.measureText(station.name) - nameClippingEnd

    let scrollOffset = 0
    if (nameOverflow > 0 && scrollCycleDuration > 0) {
      const scrollTime = Math.floor((nameOverflow * 1000) / SCROLL_SPEED)
      const scrollCycleTime = uptime % scrollCycleDuration

      if (scrollCycleTime < IDLE_TIME_LEFT) {
        // Idle left
      } else if (scrollCycleTime < IDLE_TIME_LEFT + scrollTime) {
        // Scrolling left
        const timeSinceStart = scrollCycleTime - IDLE_TIME_LEFT
        scrollOffset = Math.floor((timeSinceStart * SCROLL_SPEED) / 1000)
      } else if (scrollCycleTime < IDLE_TIME_LEFT + scrollTime + IDLE_TIME_RIGHT) {
        // Idle right
        scrollOffset = nameOverflow
      } else if (scrollCycleTime < IDLE_TIME_LEFT + 2 * scrollTime + IDLE_TIME_RIGHT) {
        // Scrolling right
        const timeSinceStart = scrollCycleTime - (IDLE_TIME_LEFT + scrollTime + IDLE_TIME_RIGHT)
        scrollOffset = nameOverflow - Math.floor((timeSinceStart * SCROLL_SPEED) / 1000)
      }
    }

    const nameColor = station.isRenting || station.isReturning ? COUNT_COLOR : UNAVAILABLE_COLOR
    this.fb.startClipping(0, 0, nameClippingEnd, this.height)
    this.font.drawText(this.fb, -scrollOffset, yOffset, station.name, nameColor)
    this.fb.endClipping()
  }
}
