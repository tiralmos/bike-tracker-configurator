import type { Readable } from "svelte/store"
import type { FeatureCollection } from "geojson"
import { config, type ConfigState } from "./state"

export interface Feed {
  code: string
  name: string
  description: string
  bounds: [number, number, number, number]
}

export interface Stop {
  stopId: string
  stopCode: string | null
  name: string
  lat: number
  lon: number
}

export interface StationListEntry {
  stationId: string
  name: string
  lat: number
  lon: number
}

export interface StationStatus {
  stationId: string
  name: string
  capacity: number | null
  docksAvailable: number
  mechanicalBikesAvailable: number
  electricBikesAvailable: number
  isInstalled: boolean
  isRenting: boolean
  isReturning: boolean
  lastReported: number | null
}

export interface Trip {
  tripId: string
  routeId: string
  routeName: string
  routeColor: string | null
  stopId: string
  stopName: string
  headsign: string
  arrivalTime: number
  departureTime: number
  isRealtime: boolean
}

export interface Schedule {
  trips: Trip[]
}

export interface Route {
  routeId: string
  name: string
  color: string | null
  headsigns: string[]
}

export type AlertLevel = "severe" | "warning" | "info"

export interface Alert {
  alertId: string
  routeIds: string[]
  level: AlertLevel
  header: string
  description: string
  /** The short line the display shows */
  text: string
  activeUntil: number | null
}

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "rain" | "snow" | "storm"

export interface Weather {
  temperature: number
  kind: WeatherKind
  weatherCode: number
  isDay: boolean
  observedAt: number
}

class TransitTrackerApi {
  private baseUrl!: string

  constructor(state: Readable<ConfigState>) {
    state.subscribe((config) => {
      this.baseUrl = new URL(config.apiBaseUrl).origin
    })
  }

  async getFeeds(): Promise<Feed[]> {
    const response = await fetch(`${this.baseUrl}/feeds`)
    if (!response.ok) {
      throw new Error(`Error fetching feeds: ${response.statusText}`)
    }
    return response.json()
  }

  async getServiceAreas(): Promise<FeatureCollection> {
    const response = await fetch(`${this.baseUrl}/feeds/service-areas`)
    if (!response.ok) {
      throw new Error(`Error fetching service areas: ${response.statusText}`)
    }
    return response.json()
  }

  async listStations(): Promise<StationListEntry[]> {
    const response = await fetch(`${this.baseUrl}/stations`)
    if (!response.ok) {
      throw new Error(`Error fetching stations: ${response.statusText}`)
    }
    return response.json()
  }

  async getStations(stationIds: string[], signal?: AbortSignal): Promise<StationStatus[]> {
    const response = await fetch(
      `${this.baseUrl}/stations/${encodeURIComponent(stationIds.join(";"))}`,
      { signal }
    )
    if (!response.ok) {
      throw new Error(`Error fetching stations: ${response.statusText}`)
    }
    const { stations } = await response.json()
    return stations
  }

  async getSchedule(pairs: string, limit: number = 10, signal?: AbortSignal): Promise<Schedule> {
    const response = await fetch(
      `${this.baseUrl}/schedule/${encodeURIComponent(pairs)}?limit=${limit}`,
      { signal }
    )
    if (!response.ok) {
      throw new Error(`Error fetching schedule: ${response.statusText}`)
    }
    return response.json()
  }

  async getAlerts(routeIds: string[], signal?: AbortSignal): Promise<Alert[]> {
    const response = await fetch(
      `${this.baseUrl}/alerts/${encodeURIComponent(routeIds.join(";"))}`,
      { signal }
    )
    if (!response.ok) {
      throw new Error(`Error fetching alerts: ${response.statusText}`)
    }
    const { alerts } = await response.json()
    return alerts
  }

  async getWeather(lat: number, lon: number, signal?: AbortSignal): Promise<Weather> {
    const response = await fetch(`${this.baseUrl}/weather?lat=${lat}&lon=${lon}`, { signal })
    if (!response.ok) {
      throw new Error(`Error fetching weather: ${response.statusText}`)
    }
    return response.json()
  }

  async getRoutesForStop(stopId: string): Promise<Route[]> {
    const response = await fetch(`${this.baseUrl}/stops/${encodeURIComponent(stopId)}/routes`)
    if (!response.ok) {
      throw new Error(`Error fetching routes for stop: ${response.statusText}`)
    }
    return response.json()
  }

  async getStopsWithin(bounds: number[][], signal?: AbortSignal): Promise<Stop[]> {
    const response = await fetch(
      `${this.baseUrl}/stops/within/${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]}`,
      { signal }
    )
    if (!response.ok) {
      throw new Error(`Error fetching stops: ${response.statusText}`)
    }
    return response.json()
  }
}

export const api = new TransitTrackerApi(config)
